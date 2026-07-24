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

// 资源预取处理

import { ORIGIN } from '../../config/constants.js';
import { jsonResponse, errorResponse } from '../../utils/response.js';

/** Block path traversal and absolute/scheme URLs in the path param. */
function isSafeAssetPath(filePath) {
  if (typeof filePath !== 'string' || !filePath) return false;
  if (filePath.length > 1024) return false;
  // Must be a relative path under the origin assets tree
  if (filePath.includes('..') || filePath.includes('\\')) return false;
  if (/^https?:\/\//i.test(filePath)) return false;
  if (/[\x00-\x1f]/.test(filePath)) return false;
  return true;
}

export async function handlePrefetch(request, env, ctx) {
  const url = new URL(request.url);
  const filePath = url.searchParams.get('path');

  if (!filePath) {
    return errorResponse('Missing path parameter', 400);
  }

  if (!isSafeAssetPath(filePath)) {
    return errorResponse('Invalid path parameter', 400);
  }

  if (!env?.BUCKET) {
    return errorResponse('Storage not configured', 503);
  }

  // Normalize: always store without leading slash
  const r2Key = filePath.replace(/^\//, '');
  if (!r2Key) {
    return errorResponse('Invalid path parameter', 400);
  }

  // 检查 R2 是否已存在
  const existing = await env.BUCKET.head(r2Key);
  if (existing) {
    return jsonResponse({
      status: 'exists',
      path: filePath,
      message: 'Resource already cached in R2',
    }, 200, {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
  }

  // 从源站获取（path 已校验，仍强制拼到固定 origin）
  const originBase = ORIGIN.sekai.replace(/\/$/, '');
  const originUrl = `${originBase}/${r2Key}`;
  const originResp = await fetch(originUrl);

  if (!originResp.ok) {
    return errorResponse('Failed to fetch from origin', originResp.status, {
      path: filePath,
      originStatus: originResp.status,
    });
  }

  // 流式写入 R2
  await env.BUCKET.put(r2Key, originResp.body, {
    httpMetadata: {
      contentType: originResp.headers.get('Content-Type') || 'application/octet-stream',
      cacheControl: 'public, max-age=31536000',
    },
  });

  return jsonResponse({
    status: 'prefetched',
    path: filePath,
    message: 'Resource successfully cached to R2',
  }, 200, {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  });
}
