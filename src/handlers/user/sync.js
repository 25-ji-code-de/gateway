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

// 用户数据同步 API

import { CONFIG } from '../../config/constants.js';
import { jsonResponse, errorResponse } from '../../utils/response.js';

const PROJECT_RE = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * 获取云端同步数据
 * GET /user/sync?project=25ji
 */
export async function getSyncData(request, env, user) {
  const url = new URL(request.url);
  const project = url.searchParams.get('project');

  if (!project || !PROJECT_RE.test(project)) {
    return errorResponse('Missing or invalid parameter: project', 400);
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
        project,
        data: null,
        version: 0,
        updated_at: null,
      });
    }

    let data;
    try {
      data = JSON.parse(result.sync_data);
    } catch {
      console.error('Corrupt sync_data for user', user.id, project);
      return errorResponse('Corrupt sync data stored; please re-upload', 500);
    }

    return jsonResponse({
      user_id: user.id,
      project,
      data,
      version: result.version,
      updated_at: result.updated_at,
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
    const contentLength = Number(request.headers.get('Content-Length') || 0);
    if (contentLength > CONFIG.SYNC_BODY_MAX_BYTES) {
      return errorResponse('Request body too large', 413);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    const { project, data, version } = body ?? {};

    if (!project || !PROJECT_RE.test(project) || data == null || typeof data !== 'object') {
      return errorResponse('Missing or invalid fields: project, data', 400);
    }

    // Guard against oversized payloads even when Content-Length is missing
    const serialized = JSON.stringify(data);
    if (serialized.length > CONFIG.SYNC_BODY_MAX_BYTES) {
      return errorResponse('Sync payload too large', 413);
    }

    const now = Date.now();
    const clientVersion = Number.isFinite(Number(version)) ? Number(version) : 0;

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
      let cloudData;
      try {
        cloudData = JSON.parse(current.sync_data);
      } catch {
        // 云端数据损坏时以客户端为准覆盖
        console.error('Corrupt cloud sync_data; overwriting', user.id, project);
        cloudData = null;
      }
      const cloudVersion = current.version;

      if (cloudData && clientVersion < cloudVersion) {
        mergedData = mergeUserData(cloudData, data);
        newVersion = cloudVersion + 1;
      } else {
        // 客户端版本相同或更新，或云端损坏：直接使用客户端数据
        newVersion = Math.max(clientVersion, cloudVersion || 0) + 1;
      }
    }

    // 保存合并后的数据（复用已序列化的客户端 data 当未合并时）
    const storedJson = mergedData === data ? serialized : JSON.stringify(mergedData);

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
      storedJson,
      newVersion,
      now,
      now,
    ).run();

    return jsonResponse({
      success: true,
      user_id: user.id,
      project,
      data: mergedData,
      version: newVersion,
      updated_at: now,
    });
  } catch (error) {
    console.error('Upload sync data error:', error);
    return errorResponse('Failed to upload sync data', 500);
  }
}

/**
 * 把一个"日期字段"解析成可比较的毫秒数。
 *
 * 客户端存的是 `new Date().toDateString()`（"Sun Jul 26 2026"），
 * 但历史数据里也可能是 ISO 串或时间戳数字，所以统一走 Date 解析
 * 而不是假定某一种格式。解析不出来的当作"没有"（null）。
 *
 * @returns {number|null} 毫秒数；无法解析时 null
 */
export function parseDay(value) {
  if (value === null || value === undefined || value === '') return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * 比较两个日期字段。
 * @returns {number} <0 表示 local 更晚，>0 表示 cloud 更晚，0 表示同一天或都没有
 */
export function compareDay(cloudValue, localValue) {
  const c = parseDay(cloudValue);
  const l = parseDay(localValue);
  if (c === null && l === null) return 0;
  if (c === null) return -1; // 只有 local 有 → local 更晚
  if (l === null) return 1;
  if (l === c) return 0;
  return l > c ? -1 : 1;
}

/** 取更晚的那一天；都解析不出来时优先保留 local 的原值。 */
export function laterDay(cloudValue, localValue) {
  const order = compareDay(cloudValue, localValue);
  if (order === 0) return localValue ?? cloudValue ?? null;
  return order < 0 ? localValue : cloudValue;
}

/** 只在确实是普通对象时返回它，否则返回空对象。 */
function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

/** 只在确实是数组时返回它，否则返回空数组。 */
function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * 合并用户数据
 * 策略：
 * 1. userStats（成就数据）：数值取最大值，数组合并去重
 * 2. preferences（偏好设置）：云端优先，本地有标记才上传
 * 3. cdPlayer（CD播放器）：云端优先，本地有标记才上传
 */
export function mergeUserData(cloudData, localData) {
  const merged = {};

  /*
   * ⚠️ 这个函数的两个入参都是**用户可控**的。
   *
   * localData 直接来自请求体，uploadSyncData 只校验了 `typeof data === 'object'`，
   * 内部结构完全不验。cloudData 则是之前某次上传原样存下来的 ——
   * 首次上传（云端还没有行）根本不走合并，所以任意形状都能落库。
   *
   * 于是：存一次畸形数据 → 之后每次「客户端版本落后」的同步都会走到这里 →
   * 一路抛到 500 → **这个用户的同步永久卡死**，得改库才能救。
   * 实测能触发的形状：recent_activities 里有 null、recent_activities 是对象、
   * unlocked_achievements 是数字（不可迭代）。
   *
   * 所以下面每一处取值都当作"可能是任何东西"处理。
   */

  // ========== 1. 用户统计数据（userStats）==========
  // 总是合并，数值取最大值
  // `|| cloudData` 是旧格式兼容：早期的 data 把统计直接放在根上，没有
  // userStats 这一层。这里保持原语义不动，只在外面套一层类型归一。
  //
  // 说明：这两处的 asObject 其实是**冗余的** —— 就算 userStats 是字符串，
  // 下面每一处取值也都各自做了判空/判类型，不会因此抛。留着是因为它把
  // "这里可能是任何东西"这件事写在了最显眼的地方。没有测试能区分它在
  // 与不在，这一点我在 PR 里说明了，不假装它有覆盖。
  const cloudStats = asObject(asObject(cloudData).userStats || cloudData);
  const localStats = asObject(asObject(localData).userStats || localData);

  merged.userStats = {};

  // 数值类型：取最大值
  //
  // today_time **不在这里** —— 它和 today_date 是一对，
  // 必须一起决定，见下面。单独取最大值会把昨天的数字贴到今天。
  const numericFields = [
    'pomodoro_count',
    'streak_days',
    'songs_played',
    'total_time'
  ];

  for (const field of numericFields) {
    // Number(...) || 0 —— 对象/数组/字符串一律归零，不让 NaN 传播下去
    merged.userStats[field] = Math.max(
      Number(cloudStats[field]) || 0,
      Number(localStats[field]) || 0
    );
  }

  // 日期字段：取更晚的那一天
  //
  // 这两个字段存的是 `new Date().toDateString()` 的结果 ——
  // "Sun Jul 26 2026" 这种**星期几开头**的格式（见 25ji-sagyo 的
  // achievements.js）。原来这里直接用 `>` 比字符串，那等于按星期名
  // 排字典序：连续两天里有 3/7 会选中**更旧**的日期。
  //
  //   "Mon Jul 27 2026" > "Sun Jul 26 2026"  →  false（M < S）
  //
  // 选中旧日期的后果不是显示错一下就完了：客户端看到
  // last_login_date 不是今天，就会重算连续天数，写下一条
  // "连续第 1 天" 的活动记录 —— 那条记录是永久的。
  merged.userStats.last_login_date = laterDay(
    cloudStats.last_login_date,
    localStats.last_login_date,
  );

  // today_time 与 today_date 是**一对**：一个数值，和它属于哪一天。
  //
  // 原来 today_time 在上面的 numericFields 里按 Math.max 合，
  // today_date 在这里单独合 —— 两边各挑各的，结果就是
  // **昨天的数字被贴上了今天的日期**。用户会看到"今天已学习 3 小时"，
  // 而那 3 小时是昨天的。
  //
  // 只有同一天才谈得上取最大值；不同天就整对采用更晚的那一天。
  const dayOrder = compareDay(cloudStats.today_date, localStats.today_date);
  if (dayOrder === 0) {
    merged.userStats.today_time = Math.max(
      Number(cloudStats.today_time) || 0,
      Number(localStats.today_time) || 0,
    );
    merged.userStats.today_date = localStats.today_date ?? cloudStats.today_date ?? null;
  } else if (dayOrder < 0) {
    // 本地更晚
    merged.userStats.today_time = Number(localStats.today_time) || 0;
    merged.userStats.today_date = localStats.today_date ?? null;
  } else {
    merged.userStats.today_time = Number(cloudStats.today_time) || 0;
    merged.userStats.today_date = cloudStats.today_date ?? null;
  }

  // 数组类型：合并去重
  //
  // `|| []` 挡不住"是数字"这种 —— 42 是真值，然后 [...42] 直接抛
  // "not iterable"。必须真的判是不是数组。
  const cloudAchievements = asArray(cloudStats.unlocked_achievements);
  const localAchievements = asArray(localStats.unlocked_achievements);
  merged.userStats.unlocked_achievements = [...new Set([...cloudAchievements, ...localAchievements])];

  // 活动记录：合并并按时间戳排序，保留最近 50 条
  const allActivities = [
    ...asArray(cloudStats.recent_activities),
    ...asArray(localStats.recent_activities),
  ];

  const activityMap = new Map();
  for (const activity of allActivities) {
    // 元素可能是 null / 字符串 / 数字 —— 跳过而不是让 activity.type 抛
    if (!activity || typeof activity !== 'object') continue;
    const timestamp = Number(activity.timestamp) || 0;
    const key = `${activity.type}_${timestamp}`;
    const existing = activityMap.get(key);
    if (!existing || (Number(existing.timestamp) || 0) < timestamp) {
      activityMap.set(key, activity);
    }
  }

  merged.userStats.recent_activities = Array.from(activityMap.values())
    .sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0))
    .slice(0, 50);

  // ========== 2. 偏好设置（preferences）==========
  // 智能合并：数组合并去重，单值本地优先
  //
  // 与上面 userStats 那两处同理：这里的 asObject 也是冗余的 ——
  // 下面每个字段各自都判了，preferences 是字符串也不会抛。
  // 没有测试能区分它在与不在。
  const cloudRoot = asObject(cloudData);
  const localRoot = asObject(localData);

  if (cloudRoot.preferences || (localRoot.preferences && localRoot.preferences_modified)) {
    const cloudPrefs = asObject(cloudRoot.preferences);
    const localPrefs = asObject(localRoot.preferences);

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
  if (cloudRoot.cdPlayer || (localRoot.cdPlayer && localRoot.cdPlayer_used)) {
    const cloudCD = asObject(cloudRoot.cdPlayer);
    const localCD = asObject(localRoot.cdPlayer);

    merged.cdPlayer = {
      // 单值字段：云端优先（保留最后使用的设备的设置）
      volume: cloudCD.volume !== undefined ? cloudCD.volume : localCD.volume,
      lastTrackId: cloudCD.lastTrackId || localCD.lastTrackId,
      lastVocalId: cloudCD.lastVocalId || localCD.lastVocalId,
      vocalPreference: cloudCD.vocalPreference || localCD.vocalPreference,
      repeat: cloudCD.repeat !== undefined ? cloudCD.repeat : localCD.repeat,
      shuffle: cloudCD.shuffle !== undefined ? cloudCD.shuffle : localCD.shuffle,

      // 数组字段：合并去重
      favorites: [...new Set([...asArray(cloudCD.favorites), ...asArray(localCD.favorites)])],
      preferredCharacters: [...new Set([...asArray(cloudCD.preferredCharacters), ...asArray(localCD.preferredCharacters)])],

      // 播放列表：合并去重（按 id 去重）
      playlists: mergePlaylistsById(asArray(cloudCD.playlists), asArray(localCD.playlists))
    };
  }

  // 保留标记
  if (cloudRoot.cdPlayer_used || localRoot.cdPlayer_used) {
    merged.cdPlayer_used = true;
  }

  return merged;
}

/**
 * 合并时区列表（去重）
 */
function mergeTimeZones(cloudZones, localZones) {
  // 原来是 `if (!cloudZones) return localZones` —— 那会把一个字符串
  // 原样当成时区列表返回出去。先归一成数组再判空。
  const cloud = asArray(cloudZones);
  const local = asArray(localZones);
  if (cloud.length === 0 && local.length === 0) return null;

  // 按 timezone 字段去重
  const zoneMap = new Map();

  for (const zone of [...cloud, ...local]) {
    if (zone && typeof zone === 'object' && zone.timezone) {
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

  // 顺序即优先级：本地在后，同 id 时覆盖云端。
  // 元素可能是 null / 字符串 —— `playlist.id` 对 null 会抛。
  for (const playlist of [...asArray(cloudPlaylists), ...asArray(localPlaylists)]) {
    if (playlist && typeof playlist === 'object' && playlist.id) {
      playlistMap.set(playlist.id, playlist);
    }
  }

  return Array.from(playlistMap.values());
}
