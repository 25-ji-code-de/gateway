// 用户相关 API

import { errorResponse } from '../../utils/response.js';
import { authenticate } from '../../middleware/auth.js';
import { getUserStats, reportUserEvent, getUserActivity } from './stats.js';
import { getUserAchievements } from './achievements.js';
import { getSyncData, uploadSyncData } from './sync.js';

export async function handleUser(request, env, ctx) {
  // 认证检查
  const user = await authenticate(request, env);
  if (!user) {
    return errorResponse('Unauthorized', 401);
  }

  const url = new URL(request.url);
  const path = url.pathname;

  // 路由分发
  if (path === '/user/stats' && request.method === 'GET') {
    return getUserStats(request, env, user);
  }

  if (path === '/user/events' && request.method === 'POST') {
    return reportUserEvent(request, env, user);
  }

  if (path === '/user/activity' && request.method === 'GET') {
    return getUserActivity(request, env, user);
  }

  if (path === '/user/achievements' && request.method === 'GET') {
    return getUserAchievements(request, env, user);
  }

  if (path === '/user/sync' && request.method === 'GET') {
    return getSyncData(request, env, user);
  }

  if (path === '/user/sync' && request.method === 'POST') {
    return uploadSyncData(request, env, user);
  }

  return errorResponse('Not found', 404);
}

