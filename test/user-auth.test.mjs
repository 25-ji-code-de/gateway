/*
 * Copyright 2026 The 25-ji-code-de Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `/user/*` 的每一条路径都必须先过鉴权。
 *
 * ── 为什么值得单独钉一条 ────────────────────────────────────────
 *
 * `handleUser` 现在是**单一入口鉴权**：进门先 `authenticate`，失败直接 401，
 * 之后才分发到各个子路径。这个形状比「每条路由各自检查」好得多 ——
 * 加新路径时不可能忘。
 *
 * 但它也很脆：只要有人把某条分发提到 `authenticate` 之前（比如
 * 「/user/ping 不需要登录，先返回吧」），那条路径就绕过了鉴权，
 * 而且**其余全部路径看起来一切正常**，没有任何报错。
 *
 * 所以这里不测「代码里有没有 authenticate」，而是**真的发请求**：
 * 无 token、坏 token、过期 token，每条路径都必须 401。
 *
 * ── 环境 ────────────────────────────────────────────────────────
 *
 * 用 node:sqlite 搭一个 D1 兼容层，让 authenticate 跑真正的 SQL
 * （它查 access_tokens 表），而不是我手写的假 db —— 假 db 很容易
 * 在「查不到就返回 null」这种地方与真实行为分叉。
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

import { handleUser } from '../src/handlers/user/index.js';

/** `handleUser` 会分发到的全部路径。 */
const PATHS = [
  ['GET', '/user/profile'],
  ['PUT', '/user/profile'],
  ['GET', '/user/stats'],
  ['POST', '/user/events'],
  ['GET', '/user/activity'],
  ['GET', '/user/achievements'],
  ['GET', '/user/leaderboard-profile'],
  ['PUT', '/user/leaderboard-profile'],
  ['GET', '/user/leaderboards/focus-all-time'],
  ['GET', '/user/sync'],
  ['POST', '/user/sync'],
];

/** 把 node:sqlite 包成 D1 的形状。 */
function makeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE access_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      client_id TEXT,
      scope TEXT,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT,
      email TEXT,
      display_name TEXT,
      avatar_url TEXT,
      bio TEXT
    );
    -- 正面用例要真的走通到 200，否则「不是 401」这个断言可以被一个
    -- 「缺表 500」满足 —— 那样它就证明不了「有效凭据确实放行」。
    CREATE TABLE user_profiles (
      user_id TEXT PRIMARY KEY,
      bio TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
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
    },
  };
}

let env;
beforeEach(() => {
  env = { DB: makeD1(), AUTH_DB: undefined };
  // sekai-worker-kit 的 authenticate 读 AUTH_DB，没有就退回 DB
  env.AUTH_DB = env.DB;
});

function req(method, path, headers = {}) {
  const init = { method, headers };
  if (method === 'POST' || method === 'PUT') {
    init.headers = { 'Content-Type': 'application/json', ...headers };
    init.body = JSON.stringify({});
  }
  return new Request(`https://api.example${path}`, init);
}

describe('/user/* 无有效凭据一律 401', () => {
  for (const [method, path] of PATHS) {
    test(`${method} ${path} —— 没有 Authorization 头`, async () => {
      const res = await handleUser(req(method, path), env, {});
      assert.equal(res.status, 401, `${method} ${path} 返回了 ${res.status}`);
    });

    test(`${method} ${path} —— token 不存在`, async () => {
      const res = await handleUser(
        req(method, path, { Authorization: 'Bearer nope' }),
        env,
        {},
      );
      assert.equal(res.status, 401);
    });
  }

  test('过期的 token 也是 401', async () => {
    env.DB._raw
      .prepare(
        'INSERT INTO access_tokens (token, user_id, client_id, scope, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run('expired', 'u1', '25ji_client', 'profile', Date.now() - 1000, Date.now() - 10000);
    env.DB._raw.prepare('INSERT INTO users (id, username) VALUES (?, ?)').run('u1', 'nako');

    const res = await handleUser(
      req('GET', '/user/profile', { Authorization: 'Bearer expired' }),
      env,
      {},
    );
    assert.equal(res.status, 401, '过期 token 被放过了');
  });

  test('格式对但不是 Bearer 的头也是 401', async () => {
    for (const value of ['Basic abc', 'bearer x', 'Bearer', 'Bearer ', 'abc']) {
      const res = await handleUser(
        req('GET', '/user/profile', { Authorization: value }),
        env,
        {},
      );
      assert.equal(res.status, 401, `Authorization: ${JSON.stringify(value)} 被放过了`);
    }
  });

  test('未知的 /user/ 子路径也不会泄漏什么（404，且仍在鉴权之后）', async () => {
    const res = await handleUser(req('GET', '/user/nonexistent'), env, {});
    // 没有凭据时应当先被 401 拦下，而不是走到 404
    assert.equal(res.status, 401, '未知路径在鉴权之前就被处理了');
  });
});

describe('有效凭据时确实放行（否则上面几条可能是「全都 401」的假象）', () => {
  /*
   * 这一条很重要：如果 handleUser 因为别的原因对所有请求都返回 401，
   * 上面那 17 条会全绿而毫无意义。
   */
  beforeEach(() => {
    env.DB._raw
      .prepare(
        'INSERT INTO access_tokens (token, user_id, client_id, scope, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run('good', 'u1', '25ji_client', 'profile', Date.now() + 3_600_000, Date.now());
    env.DB._raw
      .prepare('INSERT INTO users (id, username, email) VALUES (?, ?, ?)')
      .run('u1', 'nako', 'nako@example.test');
  });

  test('GET /user/profile 带第一方 token 时真的走通（200）', async () => {
    const res = await handleUser(
      req('GET', '/user/profile', { Authorization: 'Bearer good' }),
      env,
      {},
    );
    assert.equal(
      res.status,
      200,
      `第一方 token 拿到 ${res.status} —— 若是 401/403，说明上面那批拒绝测试是「全都拒绝」的假象`,
    );
  });
});

describe('用户 API 只服务 SEKAI 第一方 client', () => {
  beforeEach(() => {
    env.DB._raw
      .prepare(
        'INSERT INTO access_tokens (token, user_id, client_id, scope, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        'third-party',
        'u1',
        'some-third-party-client',
        'openid profile email',
        Date.now() + 3_600_000,
        Date.now(),
      );
    env.DB._raw
      .prepare('INSERT INTO users (id, username, email) VALUES (?, ?, ?)')
      .run('u1', 'third-party-user', 'user@example.test');
  });

  for (const [method, path] of PATHS) {
    test(`${method} ${path} —— 有效第三方 token 仍返回 403`, async () => {
      const res = await handleUser(
        req(method, path, { Authorization: 'Bearer third-party' }),
        env,
        {},
      );
      assert.equal(res.status, 403, `${method} ${path} 返回了 ${res.status}`);
      const body = await res.json();
      assert.equal(body.error.code, 'forbidden');
    });
  }
});

describe('鉴权与第一方边界都在分发之前（结构性质）', () => {
  /*
   * 上面测的是行为。这一条测**结构**：`authenticate` 必须出现在任何
   * 路径比较之前。行为测试只能覆盖已知路径，而这条能挡住
   * 「新加一条路径并顺手提到鉴权之前」。
   */
  test('handleUser 里 authenticate 与第一方检查都排在第一个 path 比较之前', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const root = join(dirname(fileURLToPath(import.meta.url)), '..');
    const src = readFileSync(join(root, 'src/handlers/user/index.js'), 'utf8');

    const fn = /export async function handleUser[\s\S]*?\n\}/.exec(src)?.[0];
    assert.ok(fn, '找不到 handleUser');

    const authAt = fn.indexOf('await authenticate(');
    assert.ok(authAt >= 0, 'handleUser 里没有调用 authenticate');

    const firstPathAt = fn.search(/path\s*===/);
    assert.ok(firstPathAt >= 0, '找不到路径比较 —— 分发方式变了，这条测试要跟着改');

    assert.ok(
      authAt < firstPathAt,
      'authenticate 排在了路径分发之后 —— 之前的路径绕过了鉴权',
    );

    const rejectAt = fn.indexOf("errorResponse('Unauthorized', 401)");
    assert.ok(rejectAt > authAt && rejectAt < firstPathAt, '鉴权失败没有在分发前拦下');

    const firstPartyAt = fn.indexOf('isFirstPartyClient(user.clientId)');
    assert.ok(firstPartyAt > rejectAt && firstPartyAt < firstPathAt, '第一方检查不在分发前');

    const forbiddenAt = fn.indexOf(
      "errorResponse('This API is restricted to SEKAI first-party clients', 403)",
    );
    assert.ok(
      forbiddenAt > firstPartyAt && forbiddenAt < firstPathAt,
      '第三方 client 没有在分发前 return 403',
    );
  });
});
