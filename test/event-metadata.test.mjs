/*
 * Copyright 2026 The 25-ji-code-de Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * POST /user/events 的 metadata 大小限制测试。
 *
 * metadata 会原样 JSON.stringify 后写进 user_activities。此前**完全无界** ——
 * 而隔壁 sync.js 对同类输入做了双重大小检查（Content-Length + 序列化后长度）。
 * 同一个仓里一个做了一个没做，是遗漏而不是设计选择。
 *
 * 需要已认证才能触达，所以不是匿名攻击面；但一个登录用户可以往 D1 里
 * 写任意大的行，把配额吃满。
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { reportUserEvent } from '../src/handlers/user/stats.js';
import { CONFIG } from '../src/config/constants.js';

const user = { id: 'u1', username: 'nako', email: 'n@example.com' };

/** 记录所有 D1 写入，便于断言「超限时根本没落库」。 */
function fakeEnv() {
  const writes = [];
  const stmt = {
    bind(...args) {
      writes.push(args);
      return {
        async run() {
          return { success: true };
        },
        async first() {
          return null;
        },
        async all() {
          return { results: [] };
        },
      };
    },
  };
  return {
    writes,
    DB: { prepare: () => stmt },
  };
}

function req(body) {
  return new Request('https://api.example/user/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('metadata 大小限制', () => {
  test('常量存在且是合理的量级', () => {
    assert.equal(typeof CONFIG.EVENT_METADATA_MAX_BYTES, 'number');
    assert.ok(CONFIG.EVENT_METADATA_MAX_BYTES >= 1024, '太小会打断正常写入方');
    assert.ok(
      CONFIG.EVENT_METADATA_MAX_BYTES <= CONFIG.SYNC_BODY_MAX_BYTES,
      '单条事件的 metadata 不该比整包同步数据还大',
    );
  });

  test('超限的 metadata 返回 413 且不落库', async () => {
    const env = fakeEnv();
    const huge = { blob: 'x'.repeat(CONFIG.EVENT_METADATA_MAX_BYTES + 100) };
    const response = await reportUserEvent(
      req({ project: 'nightcord', event_type: 'message_sent', metadata: huge }),
      env,
      user,
    );

    assert.equal(response.status, 413);
    assert.equal((await response.json()).error.code, 'payload_too_large');
    assert.equal(env.writes.length, 0, '超限时不应产生任何 D1 写入');
  });

  test('边界内的 metadata 正常通过', async () => {
    const env = fakeEnv();
    // 留出 JSON 结构本身的开销
    const payload = { blob: 'x'.repeat(CONFIG.EVENT_METADATA_MAX_BYTES - 100) };
    const response = await reportUserEvent(
      req({ project: 'nightcord', event_type: 'message_sent', metadata: payload }),
      env,
      user,
    );
    assert.notEqual(response.status, 413);
    assert.ok(env.writes.length > 0, '合法负载应当落库');
  });

  test('生态里真实用到的 metadata 形态都远在限制内', async () => {
    // 见 docs 的 client-conventions：这些是实际写入方
    const realWorld = [
      { minutes: 42 },                       // nightcord online_time
      { seconds: 1500 },                     // 25ji study_time
      { songId: 12345, title: 'Tell Your World' }, // 25ji song_played
      {},
    ];
    for (const metadata of realWorld) {
      const env = fakeEnv();
      const response = await reportUserEvent(
        req({ project: '25ji', event_type: 'study_time', metadata }),
        env,
        user,
      );
      assert.notEqual(response.status, 413, JSON.stringify(metadata));
    }
  });

  test('省略 metadata 时写入 null 而不是字符串 "null"', async () => {
    const env = fakeEnv();
    await reportUserEvent(req({ project: '25ji', event_type: 'song_played' }), env, user);
    assert.ok(env.writes.length > 0);
    // INSERT 的第四个绑定参数是 metadata
    assert.equal(env.writes[0][3], null);
  });

  test('metadata 为 null 时同样写 null', async () => {
    const env = fakeEnv();
    await reportUserEvent(
      req({ project: '25ji', event_type: 'song_played', metadata: null }),
      env,
      user,
    );
    assert.equal(env.writes[0][3], null);
  });
});

describe('既有校验没有被破坏', () => {
  test('缺 project / event_type 返回 400', async () => {
    for (const body of [{}, { project: 'x' }, { event_type: 'y' }]) {
      const response = await reportUserEvent(req(body), fakeEnv(), user);
      assert.equal(response.status, 400, JSON.stringify(body));
    }
  });

  test('project 必须匹配白名单字符集', async () => {
    for (const project of ['has space', 'has/slash', 'x'.repeat(65), '']) {
      const response = await reportUserEvent(
        req({ project, event_type: 'e' }),
        fakeEnv(),
        user,
      );
      assert.equal(response.status, 400, JSON.stringify(project));
    }
  });

  test('event_type 超过 64 字符返回 400', async () => {
    const response = await reportUserEvent(
      req({ project: 'nightcord', event_type: 'e'.repeat(65) }),
      fakeEnv(),
      user,
    );
    assert.equal(response.status, 400);
  });

  test('非法 JSON 返回 400', async () => {
    const bad = new Request('https://api.example/user/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    });
    const response = await reportUserEvent(bad, fakeEnv(), user);
    assert.equal(response.status, 400);
  });
});
