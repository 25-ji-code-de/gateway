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

// 贴纸自动补全数据代理
// 从 sticker.nightcord.de5.net 代理 autocomplete.json

import { DATA_SOURCES } from '../../config/constants.js';
import { jsonResponse, errorResponse } from '../../utils/response.js';
import { logCacheEvent, logError } from '../../utils/analytics.js';

const CACHE_TTL = 3600; // 1 小时（贴纸数据变化不频繁）

export async function handleStickersAutocomplete(request, env, ctx) {
  const cacheKey = new Request(request.url, request);
  const cache = caches.default;

  try {
    // 尝试从边缘缓存获取
    let response = await cache.match(cacheKey);
    if (response) {
      logCacheEvent('stickers_autocomplete', true, 'edge');
      return response;
    }

    // 从源站获取
    logCacheEvent('stickers_autocomplete', false, 'origin');
    const upstreamResponse = await fetch(DATA_SOURCES.stickersAutocomplete);

    if (!upstreamResponse.ok) {
      logError('stickers_autocomplete', new Error('Upstream fetch failed'), {
        status: upstreamResponse.status,
        url: DATA_SOURCES.stickersAutocomplete,
      });
      return errorResponse(
        'Failed to fetch stickers autocomplete data',
        upstreamResponse.status
      );
    }

    const data = await upstreamResponse.json();

    // 构造响应
    response = jsonResponse(data, 200, {
      'Cache-Control': `public, max-age=${CACHE_TTL}`,
    });

    // 写入边缘缓存
    ctx.waitUntil(cache.put(cacheKey, response.clone()));

    return response;
  } catch (error) {
    logError('stickers_autocomplete', error);
    return errorResponse('Internal Server Error', 500, error.message);
  }
}
