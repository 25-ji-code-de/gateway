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

// 用户资料 API
// 只管理扩展资料（bio），基本资料（display_name, avatar_url）由 SEKAI Pass 管理

import { jsonResponse, errorResponse } from '../../utils/response.js';

/**
 * 获取用户扩展资料
 * GET /user/profile
 */
export async function getUserProfile(request, env, user) {
  try {
    const result = await env.DB.prepare(`
      SELECT bio, created_at, updated_at
      FROM user_profiles
      WHERE user_id = ?
    `).bind(user.id).first();

    if (!result) {
      // 用户首次访问，返回空资料
      return jsonResponse({
        user_id: user.id,
        bio: null,
        created_at: null,
        updated_at: null,
      });
    }

    return jsonResponse({
      user_id: user.id,
      bio: result.bio,
      created_at: result.created_at,
      updated_at: result.updated_at,
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    return errorResponse('Failed to get user profile', 500);
  }
}

/**
 * 更新用户扩展资料
 * PUT /user/profile
 * Body: { bio? }
 */
export async function updateUserProfile(request, env, user) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    const { bio } = body ?? {};

    // 验证字段
    if (bio === undefined || bio === null) {
      return errorResponse('bio field is required', 400);
    }
    if (typeof bio !== 'string' || bio.length > 500) {
      return errorResponse('bio must be a string with max 500 characters', 400);
    }

    const now = Date.now();

    // 单次 upsert，避免 SELECT + UPDATE/INSERT 竞态
    await env.DB.prepare(`
      INSERT INTO user_profiles (user_id, bio, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        bio = excluded.bio,
        updated_at = excluded.updated_at
    `).bind(user.id, bio, now, now).run();

    return jsonResponse({
      user_id: user.id,
      bio,
      created_at: now,
      updated_at: now,
    });
  } catch (error) {
    console.error('Update user profile error:', error);
    return errorResponse('Failed to update user profile', 500);
  }
}
