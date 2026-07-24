/*
 * Copyright 2026 The 25-ji-code-de Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// 认证中间件 - 验证 SEKAI Pass 的 access token

/** Reject absurdly long Authorization values early (DoS / accidental paste). */
const MAX_TOKEN_LEN = 512;

/**
 * 验证 access token
 * 直接查询 SEKAI Pass 数据库，避免额外的网络请求
 * @returns {Promise<{id: string, username: string, email: string}|null>}
 */
export async function authenticate(request, env) {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token || token.length > MAX_TOKEN_LEN) {
    return null;
  }

  if (!env?.AUTH_DB) {
    console.error('Authentication error: AUTH_DB binding missing');
    return null;
  }

  try {
    // 查询 SEKAI Pass 数据库验证 token
    const result = await env.AUTH_DB.prepare(`
      SELECT
        at.user_id,
        at.expires_at,
        u.username,
        u.email
      FROM access_tokens at
      JOIN users u ON at.user_id = u.id
      WHERE at.token = ?
    `).bind(token).first();

    if (!result) {
      return null;
    }

    // 检查 token 是否过期（expires_at 为 epoch ms）
    const expiresAt = Number(result.expires_at);
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
      return null;
    }

    return {
      id: result.user_id,
      username: result.username,
      email: result.email,
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}
