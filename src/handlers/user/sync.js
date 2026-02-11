// 用户数据同步 API

import { jsonResponse, errorResponse } from '../../utils/response.js';

/**
 * 获取云端同步数据
 * GET /user/sync?project=25ji
 */
export async function getSyncData(request, env, user) {
  const url = new URL(request.url);
  const project = url.searchParams.get('project');

  if (!project) {
    return errorResponse('Missing required parameter: project', 400);
  }

  try {
    const result = await env.DB.prepare(`
      SELECT sync_data, version, updated_at
      FROM user_sync_data
      WHERE user_id = ? AND project = ?
    `).bind(user.id, project).first();

    if (!result) {
      // 用户首次同步，返回空数据
      return jsonResponse({
        user_id: user.id,
        project: project,
        data: null,
        version: 0,
        updated_at: null
      });
    }

    return jsonResponse({
      user_id: user.id,
      project: project,
      data: JSON.parse(result.sync_data),
      version: result.version,
      updated_at: result.updated_at
    });
  } catch (error) {
    console.error('Get sync data error:', error);
    return errorResponse('Failed to get sync data', 500);
  }
}

/**
 * 上传同步数据到云端
 * POST /user/sync
 * Body: { project, data, version }
 */
export async function uploadSyncData(request, env, user) {
  try {
    const body = await request.json();
    const { project, data, version } = body;

    if (!project || !data) {
      return errorResponse('Missing required fields: project, data', 400);
    }

    const now = Date.now();
    const clientVersion = version || 0;

    // 获取当前云端版本
    const current = await env.DB.prepare(`
      SELECT version, sync_data, updated_at
      FROM user_sync_data
      WHERE user_id = ? AND project = ?
    `).bind(user.id, project).first();

    let mergedData = data;
    let newVersion = clientVersion + 1;

    // 如果云端有数据，需要合并
    if (current) {
      const cloudData = JSON.parse(current.sync_data);
      const cloudVersion = current.version;

      // 如果客户端版本落后，需要合并数据
      if (clientVersion < cloudVersion) {
        mergedData = mergeUserData(cloudData, data);
        newVersion = cloudVersion + 1;
      } else {
        // 客户端版本相同或更新，直接使用客户端数据
        newVersion = clientVersion + 1;
      }
    }

    // 保存合并后的数据
    await env.DB.prepare(`
      INSERT INTO user_sync_data (user_id, project, sync_data, version, updated_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, project)
      DO UPDATE SET
        sync_data = excluded.sync_data,
        version = excluded.version,
        updated_at = excluded.updated_at
    `).bind(
      user.id,
      project,
      JSON.stringify(mergedData),
      newVersion,
      now,
      now
    ).run();

    return jsonResponse({
      success: true,
      user_id: user.id,
      project: project,
      data: mergedData,
      version: newVersion,
      updated_at: now
    });
  } catch (error) {
    console.error('Upload sync data error:', error);
    return errorResponse('Failed to upload sync data', 500);
  }
}

/**
 * 合并用户数据
 * 策略：
 * 1. userStats（成就数据）：数值取最大值，数组合并去重
 * 2. preferences（偏好设置）：云端优先，本地有标记才上传
 * 3. cdPlayer（CD播放器）：云端优先，本地有标记才上传
 */
function mergeUserData(cloudData, localData) {
  const merged = {};

  // ========== 1. 用户统计数据（userStats）==========
  // 总是合并，数值取最大值
  const cloudStats = cloudData.userStats || cloudData;  // 兼容旧格式
  const localStats = localData.userStats || localData;

  merged.userStats = {};

  // 数值类型：取最大值
  const numericFields = [
    'pomodoro_count',
    'streak_days',
    'songs_played',
    'total_time',
    'today_time'
  ];

  for (const field of numericFields) {
    merged.userStats[field] = Math.max(
      cloudStats[field] || 0,
      localStats[field] || 0
    );
  }

  // 时间戳类型：取最新值
  const timestampFields = [
    'last_login_date',
    'today_date'
  ];

  for (const field of timestampFields) {
    const cloudTime = cloudStats[field] || 0;
    const localTime = localStats[field] || 0;
    merged.userStats[field] = localTime > cloudTime ? localStats[field] : cloudStats[field];
  }

  // 数组类型：合并去重
  const cloudAchievements = cloudStats.unlocked_achievements || [];
  const localAchievements = localStats.unlocked_achievements || [];
  merged.userStats.unlocked_achievements = [...new Set([...cloudAchievements, ...localAchievements])];

  // 活动记录：合并并按时间戳排序，保留最近 50 条
  const cloudActivities = cloudStats.recent_activities || [];
  const localActivities = localStats.recent_activities || [];
  const allActivities = [...cloudActivities, ...localActivities];

  const activityMap = new Map();
  for (const activity of allActivities) {
    const key = `${activity.type}_${activity.timestamp}`;
    if (!activityMap.has(key) || activityMap.get(key).timestamp < activity.timestamp) {
      activityMap.set(key, activity);
    }
  }

  merged.userStats.recent_activities = Array.from(activityMap.values())
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 50);

  // ========== 2. 偏好设置（preferences）==========
  // 云端优先，本地有 preferences_modified 标记才考虑本地数据
  if (cloudData.preferences) {
    // 云端有设置，直接使用云端的
    merged.preferences = cloudData.preferences;
  } else if (localData.preferences && localData.preferences_modified) {
    // 云端没有，本地有修改标记，使用本地的
    merged.preferences = localData.preferences;
  }
  // 否则不包含 preferences（客户端使用默认值）

  // 保留标记
  if (cloudData.preferences_modified || localData.preferences_modified) {
    merged.preferences_modified = true;
  }

  // ========== 3. CD 播放器设置（cdPlayer）==========
  // 云端优先，本地有 cdPlayer_used 标记才考虑本地数据
  if (cloudData.cdPlayer) {
    // 云端有设置，直接使用云端的
    merged.cdPlayer = cloudData.cdPlayer;
  } else if (localData.cdPlayer && localData.cdPlayer_used) {
    // 云端没有，本地有使用标记，使用本地的
    merged.cdPlayer = localData.cdPlayer;
  }

  // 保留标记
  if (cloudData.cdPlayer_used || localData.cdPlayer_used) {
    merged.cdPlayer_used = true;
  }

  return merged;
}
