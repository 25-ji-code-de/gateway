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

// CORS 中间件 —— 实现已移至 @25-ji-code-de/sekai-worker-kit。
// 保留本仓历史导出名，调用点无需改动。

import { CORS_HEADERS as KIT_CORS_HEADERS, handleCors, withCors } from '@25-ji-code-de/sekai-worker-kit';

/**
 * gateway 只暴露 GET / HEAD / POST / PUT / OPTIONS。
 * worker-kit 的默认值还包含 DELETE，这里收窄回本仓原本的集合。
 */
export const CORS_HEADERS = Object.freeze({
  ...KIT_CORS_HEADERS,
  // PUT /user/profile; POST sync/events; GET/HEAD reads
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, OPTIONS',
});

/**
 * OPTIONS 预检返回 204，其余返回 null 让调用方继续。
 * @param {Request} request
 * @returns {Response|null}
 */
export function handleCORS(request) {
  return handleCors(request, CORS_HEADERS);
}

/**
 * 给已有响应补上 CORS 头。
 * @param {Response} response
 * @returns {Response}
 */
export function addCORSHeaders(response) {
  return withCors(response, CORS_HEADERS);
}
