/*
 * Copyright 2026 The 25-ji-code-de Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsonResponse, errorResponse } from '../../utils/response.js';

const BOARD_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const PERIODS = new Set(['daily', 'weekly', 'monthly', 'all_time']);
const SORT_DIRECTIONS = new Set(['asc', 'desc']);
const MAX_DISPLAY_NAME_LENGTH = 64;

const utcDate = (date) => date.toISOString().slice(0, 10);

export function getPeriodRange(period, now = new Date()) {
  const end = utcDate(now);
  if (period === 'all_time') return { start: '0000-01-01', end };
  if (period === 'daily') return { start: end, end };

  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (period === 'weekly') {
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  } else if (period === 'monthly') {
    start.setUTCDate(1);
  }
  return { start: utcDate(start), end };
}

function parsePage(url) {
  const requestedLimit = Number.parseInt(url.searchParams.get('limit') || '50', 10);
  const requestedOffset = Number.parseInt(url.searchParams.get('offset') || '0', 10);
  return {
    limit: Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 50,
    offset: Number.isFinite(requestedOffset) ? Math.max(requestedOffset, 0) : 0,
  };
}

function publicEntry(row) {
  if (!row) return null;
  return {
    rank: row.rank,
    score: row.score,
    display_name: row.display_name ?? null,
    is_public: row.is_public === 1,
  };
}

export async function getLeaderboardProfile(request, env, user) {
  try {
    const profile = await env.DB.prepare(`
      SELECT display_name, show_profile, created_at, updated_at
      FROM leaderboard_profiles
      WHERE user_id = ?
    `).bind(user.id).first();

    return jsonResponse({
      user_id: user.id,
      display_name: profile?.display_name ?? user.username,
      show_profile: profile?.show_profile === 1,
      created_at: profile?.created_at ?? null,
      updated_at: profile?.updated_at ?? null,
    });
  } catch (error) {
    console.error('Get leaderboard profile error:', error);
    return errorResponse('Failed to get leaderboard profile', 500);
  }
}

export async function updateLeaderboardProfile(request, env, user) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    const showProfile = body?.show_profile;
    const displayName = body?.display_name ?? user.username;
    if (typeof showProfile !== 'boolean') {
      return errorResponse('show_profile must be a boolean', 400);
    }
    if (
      typeof displayName !== 'string'
      || displayName.trim().length === 0
      || displayName.trim().length > MAX_DISPLAY_NAME_LENGTH
    ) {
      return errorResponse('display_name must be a non-empty string with max 64 characters', 400);
    }

    const normalizedName = displayName.trim();
    const now = Date.now();
    await env.DB.prepare(`
      INSERT INTO leaderboard_profiles (user_id, display_name, show_profile, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        display_name = excluded.display_name,
        show_profile = excluded.show_profile,
        updated_at = excluded.updated_at
    `).bind(user.id, normalizedName, showProfile ? 1 : 0, now, now).run();

    return jsonResponse({
      user_id: user.id,
      display_name: normalizedName,
      show_profile: showProfile,
      updated_at: now,
    });
  } catch (error) {
    console.error('Update leaderboard profile error:', error);
    return errorResponse('Failed to update leaderboard profile', 500);
  }
}

export async function getLeaderboard(request, env, user, boardId) {
  if (!BOARD_ID_RE.test(boardId)) return errorResponse('Invalid leaderboard id', 400);

  try {
    const board = await env.DB.prepare(`
      SELECT id, title, project, metric_name, period, sort_direction, min_score
      FROM leaderboard_definitions
      WHERE id = ? AND enabled = 1
    `).bind(boardId).first();

    if (!board) return errorResponse('Leaderboard not found', 404);
    if (!PERIODS.has(board.period) || !SORT_DIRECTIONS.has(board.sort_direction)) {
      console.error('Invalid leaderboard definition:', board.id);
      return errorResponse('Invalid leaderboard configuration', 500);
    }

    const { limit, offset } = parsePage(new URL(request.url));
    const range = getPeriodRange(board.period);
    // These SQL fragments come from strict database CHECK constraints plus runtime allowlists.
    const direction = board.sort_direction === 'asc' ? 'ASC' : 'DESC';
    const scoreCte = `
      WITH scores AS (
        SELECT us.user_id, SUM(CAST(us.metric_value AS INTEGER)) AS score
        FROM user_stats us
        WHERE us.project = ?
          AND us.metric_name = ?
          AND us.date BETWEEN ? AND ?
        GROUP BY us.user_id
        HAVING score >= ?
      ), ranked AS (
        SELECT
          user_id,
          score,
          RANK() OVER (ORDER BY score ${direction}) AS rank
        FROM scores
      )
    `;
    const bindings = [board.project, board.metric_name, range.start, range.end, board.min_score];
    const [entriesResult, meResult, countResult] = await env.DB.batch([
      env.DB.prepare(`${scoreCte}
        SELECT
          ranked.rank,
          ranked.score,
          CASE WHEN lp.show_profile = 1 THEN lp.display_name ELSE NULL END AS display_name,
          CASE WHEN lp.show_profile = 1 THEN 1 ELSE 0 END AS is_public
        FROM ranked
        LEFT JOIN leaderboard_profiles lp ON lp.user_id = ranked.user_id
        ORDER BY ranked.score ${direction}, ranked.user_id ASC
        LIMIT ? OFFSET ?
      `).bind(...bindings, limit, offset),
      env.DB.prepare(`${scoreCte}
        SELECT
          ranked.rank,
          ranked.score,
          CASE WHEN lp.show_profile = 1 THEN lp.display_name ELSE NULL END AS display_name,
          CASE WHEN lp.show_profile = 1 THEN 1 ELSE 0 END AS is_public
        FROM ranked
        LEFT JOIN leaderboard_profiles lp ON lp.user_id = ranked.user_id
        WHERE ranked.user_id = ?
      `).bind(...bindings, user.id),
      env.DB.prepare(`${scoreCte} SELECT COUNT(*) AS total FROM ranked`)
        .bind(...bindings),
    ]);

    return jsonResponse({
      leaderboard: {
        id: board.id,
        title: board.title,
        project: board.project,
        metric_name: board.metric_name,
        period: board.period,
        period_start: range.start,
        period_end: range.end,
        sort_direction: board.sort_direction,
      },
      entries: (entriesResult.results || []).map(publicEntry),
      me: publicEntry(meResult.results?.[0]),
      total: Number(countResult.results?.[0]?.total ?? 0),
      limit,
      offset,
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    return errorResponse('Failed to get leaderboard', 500);
  }
}
