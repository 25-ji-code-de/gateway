// 成就检查逻辑
import { jsonResponse } from '../../utils/response.js';

/**
 * 检查并解锁成就
 * @param {string} userId - 用户 ID
 * @param {string} project - 项目名称
 * @param {object} currentStats - 当前统计数据
 * @param {object} env - 环境变量
 * @returns {Array} 新解锁的成就列表
 */
export async function checkAndUnlockAchievements(userId, project, currentStats, env) {
  try {
    // 1. 获取该项目的所有成就
    const achievements = await env.DB.prepare(`
      SELECT id, name, description, icon, type, requirement
      FROM achievements
      WHERE project = ?
    `).bind(project).all();

    if (!achievements.results || achievements.results.length === 0) {
      return [];
    }

    // 2. 获取用户已解锁的成就
    const unlockedResult = await env.DB.prepare(`
      SELECT achievement_id
      FROM user_achievements
      WHERE user_id = ?
    `).bind(userId).all();

    const unlockedIds = new Set(
      (unlockedResult.results || []).map(r => r.achievement_id)
    );

    // 3. 检查每个未解锁的成就
    const newlyUnlocked = [];
    const now = Date.now();

    for (const achievement of achievements.results) {
      // 跳过已解锁的
      if (unlockedIds.has(achievement.id)) {
        continue;
      }

      const requirement = JSON.parse(achievement.requirement);
      let shouldUnlock = false;

      // 根据成就类型检查
      switch (achievement.type) {
        case 'stat':
          shouldUnlock = await checkStatAchievement(requirement, currentStats);
          break;

        case 'streak':
          shouldUnlock = await checkStreakAchievement(requirement, userId, project, env);
          break;

        case 'special':
          shouldUnlock = await checkSpecialAchievement(requirement, currentStats);
          break;
      }

      // 解锁成就
      if (shouldUnlock) {
        await unlockAchievement(userId, achievement.id, now, env);
        newlyUnlocked.push({
          id: achievement.id,
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon
        });
      }
    }

    return newlyUnlocked;
  } catch (error) {
    console.error('Check achievements error:', error);
    return [];
  }
}

/**
 * 检查统计类成就
 */
async function checkStatAchievement(requirement, currentStats) {
  const { metric, value } = requirement;
  const currentValue = parseInt(currentStats[metric] || 0);
  return currentValue >= value;
}

/**
 * 检查连续天数成就
 */
async function checkStreakAchievement(requirement, userId, project, env) {
  const { days } = requirement;

  // 查询用户的连续天数统计
  const today = new Date().toISOString().split('T')[0];
  const result = await env.DB.prepare(`
    SELECT metric_value
    FROM user_stats
    WHERE user_id = ? AND project = ? AND metric_name = 'streak_days' AND date = ?
  `).bind(userId, project, today).first();

  if (!result) {
    return false;
  }

  const currentStreak = parseInt(result.metric_value || 0);
  return currentStreak >= days;
}

/**
 * 检查特殊成就
 */
async function checkSpecialAchievement(requirement, currentStats) {
  const { type } = requirement;

  switch (type) {
    case 'time_check':
      // 时间段成就（如凌晨1点、早上6点）
      // 这个在事件上报时已经检查，这里返回 false
      // 实际解锁逻辑在 reportUserEvent 中处理
      return false;

    case 'session_duration':
      // 会话时长成就
      // 需要前端上报会话时长，暂不实现
      return false;

    default:
      return false;
  }
}

/**
 * 解锁成就
 */
async function unlockAchievement(userId, achievementId, timestamp, env) {
  try {
    await env.DB.prepare(`
      INSERT INTO user_achievements (user_id, achievement_id, progress, unlocked_at, created_at)
      VALUES (?, ?, 100, ?, ?)
      ON CONFLICT(user_id, achievement_id) DO NOTHING
    `).bind(userId, achievementId, timestamp, timestamp).run();

    console.log(`Achievement unlocked: ${userId} - ${achievementId}`);
  } catch (error) {
    console.error('Unlock achievement error:', error);
  }
}

/**
 * 检查时间段成就（在事件上报时调用）
 */
export async function checkTimeBasedAchievements(userId, project, env) {
  const hour = new Date().getHours();
  const now = Date.now();
  const unlocked = [];

  // 检查凌晨1点成就
  if (hour === 1) {
    const achievement = await env.DB.prepare(`
      SELECT id, name, description, icon
      FROM achievements
      WHERE project = ? AND id = ?
    `).bind(project, `${project}_night_owl`).first();

    if (achievement) {
      const alreadyUnlocked = await env.DB.prepare(`
        SELECT 1 FROM user_achievements WHERE user_id = ? AND achievement_id = ?
      `).bind(userId, achievement.id).first();

      if (!alreadyUnlocked) {
        await unlockAchievement(userId, achievement.id, now, env);
        unlocked.push(achievement);
      }
    }
  }

  // 检查早上6点前成就
  if (hour >= 4 && hour < 6) {
    const achievement = await env.DB.prepare(`
      SELECT id, name, description, icon
      FROM achievements
      WHERE project = ? AND id = ?
    `).bind(project, `${project}_early_bird`).first();

    if (achievement) {
      const alreadyUnlocked = await env.DB.prepare(`
        SELECT 1 FROM user_achievements WHERE user_id = ? AND achievement_id = ?
      `).bind(userId, achievement.id).first();

      if (!alreadyUnlocked) {
        await unlockAchievement(userId, achievement.id, now, env);
        unlocked.push(achievement);
      }
    }
  }

  return unlocked;
}
