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
  // 智能合并：数组合并去重，单值本地优先
  if (cloudData.preferences || (localData.preferences && localData.preferences_modified)) {
    const cloudPrefs = cloudData.preferences || {};
    const localPrefs = localData.preferences || {};

    merged.preferences = {
      // 单值字段：本地优先（最后修改的设备优先）
      language: localPrefs.language || cloudPrefs.language,
      visualizationEnabled: localPrefs.visualizationEnabled !== undefined ? localPrefs.visualizationEnabled : cloudPrefs.visualizationEnabled,
      clockWidgetVisible: localPrefs.clockWidgetVisible !== undefined ? localPrefs.clockWidgetVisible : cloudPrefs.clockWidgetVisible,
      userNickname: localPrefs.userNickname || cloudPrefs.userNickname,

      // 数组字段：合并去重
      worldClockTimeZones: mergeTimeZones(cloudPrefs.worldClockTimeZones, localPrefs.worldClockTimeZones),

      // 对象字段：本地优先
      healthReminderConfig: localPrefs.healthReminderConfig || cloudPrefs.healthReminderConfig
    };

    merged.preferences_modified = true;
  }

  // ========== 3. CD 播放器设置（cdPlayer）==========
  // 智能合并：favorites/playlists 合并去重，其他字段云端优先
  if (cloudData.cdPlayer || (localData.cdPlayer && localData.cdPlayer_used)) {
    const cloudCD = cloudData.cdPlayer || {};
    const localCD = localData.cdPlayer || {};

    merged.cdPlayer = {
      // 单值字段：云端优先（保留最后使用的设备的设置）
      volume: cloudCD.volume !== undefined ? cloudCD.volume : localCD.volume,
      lastTrackId: cloudCD.lastTrackId || localCD.lastTrackId,
      lastVocalId: cloudCD.lastVocalId || localCD.lastVocalId,
      vocalPreference: cloudCD.vocalPreference || localCD.vocalPreference,
      repeat: cloudCD.repeat !== undefined ? cloudCD.repeat : localCD.repeat,
      shuffle: cloudCD.shuffle !== undefined ? cloudCD.shuffle : localCD.shuffle,

      // 数组字段：合并去重
      favorites: [...new Set([...(cloudCD.favorites || []), ...(localCD.favorites || [])])],
      preferredCharacters: [...new Set([...(cloudCD.preferredCharacters || []), ...(localCD.preferredCharacters || [])])],

      // 播放列表：合并去重（按 id 去重）
      playlists: mergePlaylistsById(cloudCD.playlists || [], localCD.playlists || [])
    };
  }

  // 保留标记
  if (cloudData.cdPlayer_used || localData.cdPlayer_used) {
    merged.cdPlayer_used = true;
  }

  return merged;
}

/**
 * 合并时区列表（去重）
 */
function mergeTimeZones(cloudZones, localZones) {
  if (!cloudZones && !localZones) return null;
  if (!cloudZones) return localZones;
  if (!localZones) return cloudZones;

  // 按 timezone 字段去重
  const zoneMap = new Map();

  for (const zone of cloudZones) {
    if (zone && zone.timezone) {
      zoneMap.set(zone.timezone, zone);
    }
  }

  for (const zone of localZones) {
    if (zone && zone.timezone) {
      zoneMap.set(zone.timezone, zone);
    }
  }

  return Array.from(zoneMap.values());
}

/**
 * 合并播放列表（按 id 去重，保留最新的）
 */
function mergePlaylistsById(cloudPlaylists, localPlaylists) {
  const playlistMap = new Map();

  // 先添加云端的
  for (const playlist of cloudPlaylists) {
    if (playlist.id) {
      playlistMap.set(playlist.id, playlist);
    }
  }

  // 再添加本地的（如果 id 相同，本地覆盖云端）
  for (const playlist of localPlaylists) {
    if (playlist.id) {
      playlistMap.set(playlist.id, playlist);
    }
  }

  return Array.from(playlistMap.values());
}
