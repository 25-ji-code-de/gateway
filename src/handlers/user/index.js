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

// 用户相关 API

import { errorResponse } from '../../utils/response.js';
import { isFirstPartyClient } from '../../config/first-party-clients.js';
import { authenticate } from '../../middleware/auth.js';
import { getUserStats, reportUserEvent, getUserActivity } from './stats.js';
import { getUserAchievements } from './achievements.js';
import { getSyncData, uploadSyncData } from './sync.js';
import { getUserProfile, updateUserProfile } from './profile.js';
import {
  getLeaderboard,
  getLeaderboardProfile,
  updateLeaderboardProfile,
  submitLeaderboardScore,
} from './leaderboards.js';

export async function handleUser(request, env, ctx) {
  // 认证检查
  const user = await authenticate(request, env);
  if (!user) {
    return errorResponse('Unauthorized', 401);
  }

  // gateway 的用户 API 是 SEKAI 生态内部数据面，不是 Pass 的第三方开放 API。
  // token 有效但签发给第三方 client 时，用 403 区分于凭据无效的 401。
  if (!isFirstPartyClient(user.clientId)) {
    return errorResponse('This API is restricted to SEKAI first-party clients', 403);
  }

  if (!env?.DB) {
    return errorResponse('Database not configured', 503);
  }

  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/user/leaderboard-profile' && request.method === 'GET') {
    return getLeaderboardProfile(request, env, user);
  }

  if (path === '/user/leaderboard-profile' && request.method === 'PUT') {
    return updateLeaderboardProfile(request, env, user);
  }

  const leaderboardMatch = /^\/user\/leaderboards\/([^/]+)$/.exec(path);
  if (leaderboardMatch && request.method === 'GET') {
    return getLeaderboard(request, env, user, leaderboardMatch[1]);
  }
  if (leaderboardMatch && request.method === 'POST') {
    return submitLeaderboardScore(request, env, user, leaderboardMatch[1]);
  }

  // 路由分发
  if (path === '/user/profile' && request.method === 'GET') {
    return getUserProfile(request, env, user);
  }

  if (path === '/user/profile' && request.method === 'PUT') {
    return updateUserProfile(request, env, user);
  }

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

