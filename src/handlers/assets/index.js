// 资源路由处理

import { handlePrefetch } from './prefetch.js';
import { errorResponse } from '../../utils/response.js';

export async function handleAssets(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/assets/prefetch') {
    return await handlePrefetch(request, env, ctx);
  }

  return errorResponse('Not Found', 404);
}
