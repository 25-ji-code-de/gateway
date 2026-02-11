// 缓存工具函数

export async function getCachedResponse(cache, cacheKey) {
  return await cache.match(cacheKey);
}

export async function setCachedResponse(cache, cacheKey, response, ctx) {
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
}

export function createCacheKey(url, pathname) {
  return new Request(url.origin + pathname);
}
