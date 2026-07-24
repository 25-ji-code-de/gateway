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

// Nightcord 生态统一 API 网关

import { handleCORS, addCORSHeaders } from './src/middleware/cors.js';
import { handleSekai } from './src/handlers/sekai/index.js';
import { handleAssets } from './src/handlers/assets/index.js';
import { handleUser } from './src/handlers/user/index.js';
import { handleChat } from './src/handlers/chat/index.js';
import { handleStudy } from './src/handlers/study/index.js';
import { errorResponse, jsonResponse } from './src/utils/response.js';
import { logMetrics, logError } from './src/utils/analytics.js';

export default {
  async fetch(request, env, ctx) {
    const startTime = Date.now();

    // CORS 预检
    const corsResponse = handleCORS(request);
    if (corsResponse) return addCORSHeaders(corsResponse);

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      let response;

      // 健康检查 / 服务索引
      if (path === '/' || path === '/health') {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          response = errorResponse('Method Not Allowed', 405);
        } else {
          response = jsonResponse({
            service: 'gateway',
            status: 'ok',
            version: '1.0.0',
            routes: ['/sekai/*', '/assets/*', '/user/*', '/chat/*', '/study/*'],
          });
          if (request.method === 'HEAD') {
            response = new Response(null, {
              status: response.status,
              headers: response.headers,
            });
          }
        }
      } else if (path.startsWith('/sekai/')) {
        response = await handleSekai(request, env, ctx);
      } else if (path.startsWith('/assets/')) {
        response = await handleAssets(request, env, ctx);
      } else if (path.startsWith('/user/')) {
        response = await handleUser(request, env, ctx);
      } else if (path.startsWith('/chat/')) {
        response = await handleChat(request, env, ctx, null);
      } else if (path.startsWith('/study/')) {
        response = await handleStudy(request, env, ctx, null);
      } else {
        response = errorResponse('Not Found', 404);
      }

      // 记录请求指标（logMetrics 为同步；waitUntil 接受 Promise）
      const duration = Date.now() - startTime;
      ctx.waitUntil(
        Promise.resolve().then(() => logMetrics(ctx, request, response, duration)),
      );

      return addCORSHeaders(response);
    } catch (error) {
      logError('fetch', error, { path, method: request.method });

      // 不把内部 error.message 暴露给客户端
      const response = errorResponse('Internal Server Error', 500);
      const duration = Date.now() - startTime;
      ctx.waitUntil(
        Promise.resolve().then(() =>
          logMetrics(ctx, request, response, duration, { error: true }),
        ),
      );

      return addCORSHeaders(response);
    }
  },
};
