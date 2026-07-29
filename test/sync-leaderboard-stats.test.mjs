import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mirror25jiLeaderboardStats } from '../src/handlers/user/sync.js';

describe('25ji sync leaderboard metrics', () => {
  test('mirrors cumulative counters and unique achievement progress', async () => {
    const writes = [];
    const env = {
      DB: {
        prepare(sql) {
          return {
            bind(...bindings) {
              return { run: async () => writes.push({ sql, bindings }) };
            },
          };
        },
      },
    };

    await mirror25jiLeaderboardStats(env, 'u1', {
      userStats: {
        songs_played: 42.9,
        streak_days: 7,
        unlocked_achievements: ['a', 'b', 'a', 123],
      },
    }, Date.parse('2026-07-29T12:00:00Z'));

    assert.deepEqual(writes.map(({ bindings }) => bindings.slice(0, 4)), [
      ['u1', 'songs_played', '42', '2026-07-29'],
      ['u1', 'streak_days', '7', '2026-07-29'],
      ['u1', 'achievements_unlocked', '2', '2026-07-29'],
    ]);
    assert.ok(writes.every(({ sql }) => sql.includes('MAX(CAST(metric_value AS INTEGER)')));
  });

  test('normalizes malformed counters instead of rejecting sync', async () => {
    const values = [];
    const env = {
      DB: {
        prepare() {
          return {
            bind(...bindings) {
              values.push(bindings[2]);
              return { run: async () => undefined };
            },
          };
        },
      },
    };

    await mirror25jiLeaderboardStats(env, 'u1', {
      songs_played: -1,
      streak_days: { bad: true },
      unlocked_achievements: 'not-an-array',
    }, 0);

    assert.deepEqual(values, ['0', '0', '0']);
  });
});
