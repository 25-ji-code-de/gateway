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

    const achievements = result.results.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      icon: row.icon,
      project: row.project,
      type: row.type,
      requirement: JSON.parse(row.requirement),
      progress: row.progress || 0,
      unlocked: row.unlocked_at !== null,
      unlocked_at: row.unlocked_at
    }));

    return jsonResponse({
      user_id: user.id,
      achievements: achievements
    });
  } catch (error) {
    console.error('Get achievements error:', error);
    return errorResponse('Failed to get achievements', 500);
  }
}

/**
 * 检查并解锁成就
 * 这个函数会在用户事件上报后自动调用
 */
export async function checkAchievements(env, userId, project, eventType) {
  try {
    // 获取所有未解锁的成就
    const achievements = await env.DB.prepare(`
      SELECT a.id, a.requirement
      FROM achievements a
      LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = ?
      WHERE ua.unlocked_at IS NULL OR ua.unlocked_at IS NOT NULL
    `).bind(userId).all();

    for (const achievement of achievements.results) {
      const requirement = JSON.parse(achievement.requirement);

      // 检查是否满足解锁条件
      const shouldUnlock = await checkRequirement(env, userId, requirement);

      if (shouldUnlock) {
        // 解锁成就
        const now = Date.now();
        await env.DB.prepare(`
          INSERT INTO user_achievements (user_id, achievement_id, progress, unlocked_at, created_at)
          VALUES (?, ?, 100, ?, ?)
          ON CONFLICT(user_id, achievement_id)
          DO UPDATE SET unlocked_at = ?, progress = 100
        `).bind(userId, achievement.id, now, now, now).run();
      }
    }
  } catch (error) {
    console.error('Check achievements error:', error);
  }
}

/**
 * 检查是否满足成就要求
 */
async function checkRequirement(env, userId, requirement) {
  const { type, project, metric, value } = requirement;

  if (type === 'stat') {
    // 统计类成就：检查某个指标是否达到目标值
    const result = await env.DB.prepare(`
      SELECT SUM(CAST(metric_value AS INTEGER)) as total
      FROM user_stats
      WHERE user_id = ? AND project = ? AND metric_name = ?
    `).bind(userId, project, metric).first();

    return result && result.total >= value;
  }

  if (type === 'streak') {
    // 连续类成就：检查连续天数
    const result = await env.DB.prepare(`
      SELECT COUNT(DISTINCT date) as days
      FROM user_stats
      WHERE user_id = ? AND project = ?
      AND date >= date('now', '-' || ? || ' days')
    `).bind(userId, project, value).first();

    return result && result.days >= value;
  }

  return false;
}
