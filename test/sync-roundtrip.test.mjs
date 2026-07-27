/*
 * Copyright 2026 The 25-ji-code-de Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `/user/sync` 的完整往返 —— 用真 SQL 引擎，不是 mock。
 *
 * 单元测试只喂 `mergeUserData` 两个对象，盖不到最关键的那条路径：
 *
 *   **存进去 → 下次同步再读出来合并**
 *
 * 「畸形数据把用户的同步永久弄死」正是这条路径上的事：首次上传不走合并，
 * 任意形状都能落库；之后每次「客户端版本落后」的同步才会撞上合并。
 * 只测合并函数的话，这个循环根本没被走过。
 *
 * 这里用 node:sqlite 包一个 D1 兼容层，让 handler 跑真正的 SQL
 * （含 `INSERT … ON CONFLICT … DO UPDATE`），而不是我手写的假 db。
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

import { uploadSyncData, getSyncData } from '../src/handlers/user/sync.js';

const USER = { id: 'u1' };

/** 把 node:sqlite 包成 D1 的形状（只实现 handler 用到的部分）。 */
function makeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE user_sync_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      project TEXT NOT NULL,
      sync_data TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(user_id, project)
    );
  `);

  return {
    _raw: db,
    prepare(sql) {
      return {
        args: [],
        bind(...args) {
          this.args = args;
          return this;
        },
        async first() {
          const rows = db.prepare(sql).all(...this.args);
          return rows[0] ?? null;
        },
        async all() {
          return { results: db.prepare(sql).all(...this.args) };
        },
        async run() {
          const info = db.prepare(sql).run(...this.args);
          return { success: true, meta: { changes: Number(info.changes ?? 0) } };
        },
      };
    },
  };
}

/** 构造一个 Request。 */
function req(body) {
  return new Request('https://api.example/user/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

let env;
beforeEach(() => {
  env = { DB: makeD1() };
});

/** 上传一次，返回解析后的响应体。 */
async function upload(data, version) {
  const res = await uploadSyncData(req({ project: '25ji', data, version }), env, USER);
  return { status: res.status, body: await res.json() };
}

async function fetchCloud() {
  const res = await getSyncData(
    new Request('https://api.example/user/sync?project=25ji'),
    env,
    USER,
  );
  return { status: res.status, body: await res.json() };
}

/** 客户端 today_date / last_login_date 的格式。 */
const day = (iso) => new Date(`${iso}T12:00:00Z`).toDateString();

describe('往返：首次上传 → 落库 → 再次上传触发合并', () => {
  test('首次上传不走合并，原样落库', async () => {
    const first = await upload({ userStats: { pomodoro_count: 3 } }, 0);
    assert.equal(first.status, 200);
    assert.equal(first.body.version, 1);

    const cloud = await fetchCloud();
    assert.equal(cloud.body.data.userStats.pomodoro_count, 3);
  });

  test('客户端版本落后时才合并，累计值取大', async () => {
    await upload({ userStats: { pomodoro_count: 10 } }, 0); // → version 1
    // 另一台设备还停在 version 0
    const second = await upload({ userStats: { pomodoro_count: 4 } }, 0);
    assert.equal(second.body.data.userStats.pomodoro_count, 10, '合并应当取大');
    assert.equal(second.body.version, 2);
  });

  test('版本不落后时直接覆盖', async () => {
    const a = await upload({ userStats: { pomodoro_count: 10 } }, 0);
    const b = await upload({ userStats: { pomodoro_count: 4 } }, a.body.version);
    assert.equal(b.body.data.userStats.pomodoro_count, 4, '不落后就以客户端为准');
  });
});

describe('畸形数据存进去之后，同步不会永久卡死', () => {
  /*
   * 修复前：这三种形状首次上传能落库（不走合并），
   * 之后每次落后同步都会在 mergeUserData 里抛，一路 500 —— 永久卡死，
   * 得改库才能救。
   */
  const MALFORMED = [
    ['recent_activities 里有 null', { userStats: { recent_activities: [null] } }],
    ['recent_activities 是对象', { userStats: { recent_activities: { a: 1 } } }],
    ['unlocked_achievements 是数字', { userStats: { unlocked_achievements: 42 } }],
  ];

  for (const [label, bad] of MALFORMED) {
    test(label, async () => {
      // 1. 先把畸形数据存进去（首次上传，不走合并）
      const first = await upload(bad, 0);
      assert.equal(first.status, 200, '首次上传应当成功 —— 这正是它能落库的原因');

      // 2. 再来一次落后的同步 —— 这次会走合并
      const second = await upload({ userStats: { pomodoro_count: 1 } }, 0);
      assert.equal(second.status, 200, '合并不应当 500');
      assert.ok(
        Array.isArray(second.body.data.userStats.recent_activities),
        '产出结构必须可用',
      );

      // 3. 再来一次，确认没有把畸形数据又写回去
      const third = await upload({ userStats: { pomodoro_count: 2 } }, 0);
      assert.equal(third.status, 200, '第三次同样不应当 500');
    });
  }

  test('畸形数据也不会让读取端 500', async () => {
    await upload({ userStats: { recent_activities: [null] } }, 0);
    const cloud = await fetchCloud();
    assert.equal(cloud.status, 200);
  });
});

describe('日期合并：往返之后 today 仍然是 today', () => {
  test('昨天的时长不会被贴上今天的日期', async () => {
    // 云端：昨天学了 3 小时
    await upload(
      { userStats: { today_time: 10800, today_date: day('2026-07-26'), pomodoro_count: 5 } },
      0,
    );
    // 本地：今天刚开始 10 分钟，版本落后 → 触发合并
    const merged = await upload(
      { userStats: { today_time: 600, today_date: day('2026-07-27'), pomodoro_count: 1 } },
      0,
    );

    assert.equal(merged.body.data.userStats.today_date, day('2026-07-27'), '应当是今天');
    assert.equal(merged.body.data.userStats.today_time, 600, '今天就是 600 秒');
    assert.equal(merged.body.data.userStats.pomodoro_count, 5, '累计值仍然取大');
  });

  test('连续两天的登录日按真实先后取，不受星期名字典序影响', async () => {
    // Sun -> Mon 是字符串比较会挑错的那一组
    await upload({ userStats: { last_login_date: day('2026-07-26') } }, 0);
    const merged = await upload({ userStats: { last_login_date: day('2026-07-27') } }, 0);
    assert.equal(merged.body.data.userStats.last_login_date, day('2026-07-27'));
  });
});

describe('版本号单调递增', () => {
  test('连续同步版本一直往上走，不会回退', async () => {
    let version = 0;
    const seen = [];
    for (let i = 0; i < 5; i++) {
      const r = await upload({ userStats: { pomodoro_count: i } }, version);
      seen.push(r.body.version);
      version = r.body.version;
    }
    for (let i = 1; i < seen.length; i++) {
      assert.ok(seen[i] > seen[i - 1], `版本回退了：${seen.join(' -> ')}`);
    }
  });
});
