// 贴纸自动补全数据代理
// 从 sticker.nightcord.de5.net 代理 autocomplete.json

import { DATA_SOURCES } from '../../config/constants.js';
import { jsonResponse, errorResponse } from '../../utils/response.js';

const CACHE_TTL = 3600; // 1 小时（贴纸数据变化不频繁）

export async function handleStickersAutocomplete(request, env, ctx) {
  const cacheKey = new Request(request.url, request);
  const cache = caches.default;

  try {
    // 尝试从边缘缓存获取
    let response = await cache.match(cacheKey);
    if (response) {
      return response;
    }

    // 从源站获取
    const upstreamResponse = await fetch(DATA_SOURCES.stickersAutocomplete);

    if (!upstreamResponse.ok) {
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
    console.error('Error fetching stickers autocomplete:', error);
    return errorResponse('Internal Server Error', 500, error.message);
  }
}
