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

// 成就系统 API

import { jsonResponse, errorResponse } from '../../utils/response.js';

/**
 * 获取用户成就列表
 * GET /user/achievements
 */
export async function getUserAchievements(request, env, user) {
  try {
    const result = await env.DB.prepare(`
      SELECT
        a.id,
        a.name,
        a.description,
        a.icon,
        a.project,
        a.type,
        a.requirement,
        ua.progress,
        ua.unlocked_at
      FROM achievements a
      LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = ?
      ORDER BY ua.unlocked_at DESC NULLS LAST, a.created_at
    `).bind(user.id).all();

    const achievements = result.results.map((row) => {
      let requirement = row.requirement;
      if (typeof requirement === 'string') {
        try {
          requirement = JSON.parse(requirement);
        } catch {
          requirement = null;
        }
      }
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        icon: row.icon,
        project: row.project,
        type: row.type,
        requirement,
        progress: row.progress || 0,
        unlocked: row.unlocked_at !== null,
        unlocked_at: row.unlocked_at,
      };
    });

    return jsonResponse({
      user_id: user.id,
      achievements: achievements
    });
  } catch (error) {
    console.error('Get achievements error:', error);
    return errorResponse('Failed to get achievements', 500);
  }
}

/*
 * 这里原本有 checkAchievements() 与 checkRequirement()。删掉了。
 *
 * 1. **它们是死代码。** 全仓没有任何地方 import 它们；真正在跑的是
 *    achievement-checker.js 的 checkAndUnlockAchievements，
 *    由 stats.js 调用。
 *
 * 2. **而且写错了。** 它的主查询是
 *
 *      WHERE ua.unlocked_at IS NULL OR ua.unlocked_at IS NOT NULL
 *
 *    注释写着"获取所有**未解锁**的成就"，但这个谓词恒真 ——
 *    取的是全部成就。配上下面的
 *
 *      ON CONFLICT ... DO UPDATE SET unlocked_at = ?
 *
 *    每次检查都会把**已解锁**成就的 unlocked_at 刷成当前时间，
 *    "什么时候拿到的"这个信息会被抹掉。
 *
 *    achievement-checker.js 那份是对的：先把已解锁的读进 Set 跳过，
 *    插入用 ON CONFLICT DO NOTHING。
 *
 * 留着一份没人调用、逻辑还相反的实现，只会让下一个想接线的人接错。
 */
