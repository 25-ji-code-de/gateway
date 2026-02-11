// 用户统计 API

import { jsonResponse, errorResponse } from '../../utils/response.js';

/**
 * 获取用户统计数据
 * GET /user/stats?project=nightcord&date=2026-02-11
 */
export async function getUserStats(request, env, user) {
  const url = new URL(request.url);
  const project = url.searchParams.get('project');
  const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];

  try {
    let query;
    let params;

    if (project) {
      // 查询特定项目的统计
      query = `
        SELECT project, metric_name, metric_value, date
        FROM user_stats
        WHERE user_id = ? AND project = ? AND date = ?
        ORDER BY metric_name
      `;
      params = [user.id, project, date];
    } else {
      // 查询所有项目的统计
      query = `
        SELECT project, metric_name, metric_value, date
        FROM user_stats
        WHERE user_id = ? AND date = ?
        ORDER BY project, metric_name
      `;
      params = [user.id, date];
    }

    const result = await env.DB.prepare(query).bind(...params).all();

    // 按项目分组
    const stats = {};
    for (const row of result.results) {
      if (!stats[row.project]) {
        stats[row.project] = {};
      }
      stats[row.project][row.metric_name] = row.metric_value;
    }

    return jsonResponse({
      user_id: user.id,
      date: date,
      stats: stats
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    return errorResponse('Failed to get user stats', 500);
  }
}

/**
 * 上报用户事件
 * POST /user/events
 * Body: { project, event_type, metadata }
 */
export async function reportUserEvent(request, env, user) {
  try {
    const body = await request.json();
    const { project, event_type, metadata } = body;

    if (!project || !event_type) {
      return errorResponse('Missing required fields: project, event_type', 400);
    }

    const now = Date.now();

    // 插入活动记录
    await env.DB.prepare(`
      INSERT INTO user_activities (user_id, project, event_type, metadata, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      user.id,
      project,
      event_type,
      metadata ? JSON.stringify(metadata) : null,
      now
    ).run();

    // 更新统计数据（根据事件类型）
    await updateStats(env, user.id, project, event_type, metadata);

    return jsonResponse({
      success: true,
      message: 'Event reported successfully'
    });
  } catch (error) {
    console.error('Report event error:', error);
    return errorResponse('Failed to report event', 500);
  }
}

/**
 * 根据事件类型更新统计数据
 */
async function updateStats(env, userId, project, eventType, metadata) {
  const date = new Date().toISOString().split('T')[0];
  const now = Date.now();

  // 根据不同的事件类型更新不同的指标
  const updates = [];

  switch (eventType) {
    case 'message_sent':
      updates.push({ metric: 'messages_sent', increment: 1 });
      break;
    case 'online_time':
      updates.push({ metric: 'online_minutes', increment: metadata?.minutes || 0 });
      break;
    case 'pomodoro_completed':
      updates.push({ metric: 'pomodoros_completed', increment: 1 });
      updates.push({ metric: 'study_minutes', increment: 25 });
      break;
    case 'song_played':
      updates.push({ metric: 'songs_played', increment: 1 });
      break;
    case 'nako_conversation':
      updates.push({ metric: 'nako_conversations', increment: 1 });
      break;
  }

  // 批量更新统计
  for (const { metric, increment } of updates) {
    await env.DB.prepare(`
      INSERT INTO user_stats (user_id, project, metric_name, metric_value, date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, project, metric_name, date)
      DO UPDATE SET
        metric_value = CAST(metric_value AS INTEGER) + ?,
        updated_at = ?
    `).bind(
      userId, project, metric, increment.toString(), date, now, now,
      increment, now
    ).run();
  }
}

/**
 * 获取用户活动时间线
 * GET /user/activity?limit=20&offset=0
 */
export async function getUserActivity(request, env, user) {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  try {
    const result = await env.DB.prepare(`
      SELECT project, event_type, metadata, created_at
      FROM user_activities
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(user.id, limit, offset).all();

    const activities = result.results.map(row => ({
      project: row.project,
      event_type: row.event_type,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      created_at: row.created_at
    }));

    return jsonResponse({
      user_id: user.id,
      activities: activities,
      limit: limit,
      offset: offset
    });
  } catch (error) {
    console.error('Get user activity error:', error);
    return errorResponse('Failed to get user activity', 500);
  }
}
