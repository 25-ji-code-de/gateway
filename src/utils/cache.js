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
