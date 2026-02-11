// Nightcord 生态统一 API 网关

import { handleCORS, addCORSHeaders } from './src/middleware/cors.js';
import { handleSekai } from './src/handlers/sekai/index.js';
import { handleAssets } from './src/handlers/assets/index.js';
import { handleUser } from './src/handlers/user/index.js';
import { handleChat } from './src/handlers/chat/index.js';
import { handleStudy } from './src/handlers/study/index.js';
import { errorResponse } from './src/utils/response.js';

export default {
  async fetch(request, env, ctx) {
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
        // TODO: 添加认证中间件
        response = await handleUser(request, env, ctx, null);
      } else if (path.startsWith('/chat/')) {
        // TODO: 添加认证中间件
        response = await handleChat(request, env, ctx, null);
      } else if (path.startsWith('/study/')) {
        // TODO: 添加认证中间件
        response = await handleStudy(request, env, ctx, null);
      } else {
        response = errorResponse('Not Found', 404);
      }

      return addCORSHeaders(response);
    } catch (error) {
      console.error('Unhandled error:', error);
      const response = errorResponse('Internal Server Error', 500, error.message);
      return addCORSHeaders(response);
    }
  },
};
