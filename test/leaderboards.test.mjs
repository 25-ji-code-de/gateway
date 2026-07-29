/*
 * Copyright 2026 The 25-ji-code-de Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getLeaderboard,
  getLeaderboardProfile,
  getPeriodRange,
  updateLeaderboardProfile,
} from '../src/handlers/user/leaderboards.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function makeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(join(root, 'schema.sql'), 'utf8'));

  const prepare = (sql) => {
    const statement = {
      args: [],
      bind(...args) {
        this.args = args;
        return this;
      },
      async first() {
        return db.prepare(sql).all(...this.args)[0] ?? null;
      },
      async all() {
        return { results: db.prepare(sql).all(...this.args) };
      },
      async run() {
        const info = db.prepare(sql).run(...this.args);
        return { success: true, meta: { changes: Number(info.changes ?? 0) } };
      },
    };
    return statement;
  };

  return {
    _raw: db,
    prepare,
    async batch(statements) {
      return Promise.all(statements.map((statement) => statement.all()));
    },
  };
}

const request = (path, init) => new Request(`https://api.example${path}`, init);
const user = { id: 'u1', username: 'miku' };
let env;

beforeEach(() => {
  env = { DB: makeD1() };
});

describe('leaderboard periods', () => {
  test('uses UTC calendar boundaries', () => {
    const now = new Date('2026-07-29T12:00:00Z');
    assert.deepEqual(getPeriodRange('daily', now), {
      start: '2026-07-29', end: '2026-07-29',
    });
    assert.deepEqual(getPeriodRange('weekly', now), {
      start: '2026-07-27', end: '2026-07-29',
    });
    assert.deepEqual(getPeriodRange('monthly', now), {
      start: '2026-07-01', end: '2026-07-29',
    });
    assert.deepEqual(getPeriodRange('all_time', now), {
      start: '0000-01-01', end: '2026-07-29',
    });
  });
});

describe('leaderboard profile', () => {
  test('defaults to private and uses the authenticated username', async () => {
    const response = await getLeaderboardProfile(
      request('/user/leaderboard-profile'), env, user,
    );
    assert.deepEqual(await response.json(), {
      user_id: 'u1',
      display_name: 'miku',
      show_profile: false,
      created_at: null,
      updated_at: null,
    });
  });

  test('requires an explicit visibility boolean and validates the public name', async () => {
    for (const body of [{}, { show_profile: 'yes' }, { show_profile: true, display_name: ' ' }]) {
      const response = await updateLeaderboardProfile(
        request('/user/leaderboard-profile', {
          method: 'PUT', body: JSON.stringify(body),
        }),
        env,
        user,
      );
      assert.equal(response.status, 400, JSON.stringify(body));
    }
  });

  test('persists profile visibility and a trimmed display name', async () => {
    const response = await updateLeaderboardProfile(
      request('/user/leaderboard-profile', {
        method: 'PUT',
        body: JSON.stringify({ show_profile: true, display_name: '  Hatsune Miku  ' }),
      }),
      env,
      user,
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.display_name, 'Hatsune Miku');
    assert.equal(body.show_profile, true);
  });
});

describe('leaderboard query', () => {
  beforeEach(() => {
    const db = env.DB._raw;
    const now = Date.now();
    db.prepare(`
      INSERT INTO leaderboard_definitions
        (id, title, project, metric_name, period, sort_direction, min_score, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('focus-all-time', 'Focus time', '25ji', 'study_minutes', 'all_time', 'desc', 1, now, now);

    for (const [id, name, showProfile] of [
      ['u1', 'Miku', 1], ['u2', 'Rin', 1], ['u3', 'Len', 1], ['u4', 'Private', 0],
    ]) {
      db.prepare(`
        INSERT INTO leaderboard_profiles (user_id, display_name, show_profile, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, name, showProfile, now, now);
    }

    for (const [id, value, date] of [
      ['u1', '30', '2026-07-28'], ['u1', '20', '2026-07-29'],
      ['u2', '50', '2026-07-29'], ['u3', '10', '2026-07-29'],
      ['u4', '9999', '2026-07-29'],
      ['u5', '5', '2026-07-29'],
    ]) {
      db.prepare(`
        INSERT INTO user_stats
          (user_id, project, metric_name, metric_value, date, created_at, updated_at)
        VALUES (?, '25ji', 'study_minutes', ?, ?, ?, ?)
      `).run(id, value, date, now, now);
    }
  });

  test('aggregates days, shares ranks on ties, and anonymizes private users', async () => {
    const response = await getLeaderboard(
      request('/user/leaderboards/focus-all-time'), env, user, 'focus-all-time',
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.total, 5);
    assert.deepEqual(body.entries.map(({ rank, score, display_name, is_public }) => ({
      rank: Number(rank), score: Number(score), display_name, is_public,
    })), [
      { rank: 1, score: 9999, display_name: null, is_public: false },
      { rank: 2, score: 50, display_name: 'Miku', is_public: true },
      { rank: 2, score: 50, display_name: 'Rin', is_public: true },
      { rank: 4, score: 10, display_name: 'Len', is_public: true },
      { rank: 5, score: 5, display_name: null, is_public: false },
    ]);
    assert.equal(Number(body.me.rank), 2);
    assert.equal(Number(body.me.score), 50);
  });

  test('caps page size and keeps the current user rank outside the page', async () => {
    const response = await getLeaderboard(
      request('/user/leaderboards/focus-all-time?limit=1&offset=2'),
      env,
      user,
      'focus-all-time',
    );
    const body = await response.json();
    assert.equal(body.entries.length, 1);
    assert.equal(body.entries[0].display_name, 'Rin');
    assert.equal(Number(body.me.rank), 2);
  });

  test('rejects unknown and malformed board ids', async () => {
    const missing = await getLeaderboard(
      request('/user/leaderboards/missing'), env, user, 'missing',
    );
    assert.equal(missing.status, 404);

    const malformed = await getLeaderboard(
      request('/user/leaderboards/bad.id'), env, user, 'bad.id',
    );
    assert.equal(malformed.status, 400);
  });
});
