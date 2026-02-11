// Nightcord 生态统一 API 网关

import { handleCORS, addCORSHeaders } from './src/middleware/cors.js';
import { handleSekai } from './src/handlers/sekai/index.js';
import { handleAssets } from './src/handlers/assets/index.js';
import { handleUser } from './src/handlers/user/index.js';
import { handleChat } from './src/handlers/chat/index.js';
import { handleStudy } from './src/handlers/study/index.js';
import { errorResponse } from './src/utils/response.js';
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

      // 路由分发
      if (path.startsWith('/sekai/')) {
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

      // 记录请求指标
      const duration = Date.now() - startTime;
      ctx.waitUntil(
        Promise.resolve(logMetrics(ctx, request, response, duration))
      );

      return addCORSHeaders(response);
    } catch (error) {
      // 记录错误
      logError('fetch', error, { path, method: request.method });

      const response = errorResponse('Internal Server Error', 500, error.message);
      const duration = Date.now() - startTime;
      ctx.waitUntil(
        Promise.resolve(logMetrics(ctx, request, response, duration, { error: true }))
      );

      return addCORSHeaders(response);
    }
  },
};
