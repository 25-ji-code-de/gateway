// SEKAI 路由处理

import { handleMusicData } from './music-data.js';
import { errorResponse } from '../../utils/response.js';

export async function handleSekai(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/sekai/music_data.json') {
    return await handleMusicData(request, env, ctx);
  }

  return errorResponse('Not Found', 404);
}
