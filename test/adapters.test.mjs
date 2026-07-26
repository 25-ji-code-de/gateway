/*
 * Copyright 2026 The 25-ji-code-de Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * gateway 接入 @25-ji-code-de/sekai-worker-kit 后的契约测试。
 *
 * 重点不是测 worker-kit（那边自己有 28 个测试），而是钉住 gateway
 * **对外的线路格式**：错误信封是新形状、hub / 25ji 依赖的顶层 message
 * 仍在、handler 的自定义成功结构没有被意外包装。
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import worker from '../index.js';
import { errorResponse, successResponse, jsonResponse } from '../src/utils/response.js';
import { authenticate } from '../src/middleware/auth.js';
import { CORS_HEADERS, handleCORS, addCORSHeaders } from '../src/middleware/cors.js';

const ctx = { waitUntil: () => {} };

describe('错误信封', () => {
  test('结构化 error 与兼容用的顶层 message 同时存在', async () => {
    const body = await errorResponse('Not Found', 404).json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'not_found');
    assert.equal(body.error.message, 'Not Found');
    // hub 与 25ji 的 API.request() 读的是这个，删了会让前端只剩状态码
    assert.equal(body.message, 'Not Found');
  });

  test('状态码推导出错误码', async () => {
    const cases = [
      [400, 'invalid_request'],
      [401, 'unauthorized'],
      [403, 'forbidden'],
      [404, 'not_found'],
      [405, 'method_not_allowed'],
      [413, 'payload_too_large'],
      [500, 'server_error'],
      [503, 'service_unavailable'],
    ];
    for (const [status, code] of cases) {
      const body = await errorResponse('x', status).json();
      assert.equal(body.error.code, code, `status ${status}`);
    }
  });

  test('未知状态码回退到 error', async () => {
    assert.equal((await errorResponse('x', 418).json()).error.code, 'error');
  });

  test('显式 code 覆盖状态码推导', async () => {
    const body = await errorResponse('corrupt', 500, null, 'sync_corrupt').json();
    assert.equal(body.error.code, 'sync_corrupt');
  });

  test('details 传 Error 时只取 message，不泄 stack', async () => {
    const body = await errorResponse('boom', 503, new Error('inner failure')).json();
    assert.equal(body.error.details, 'inner failure');
    assert.ok(!JSON.stringify(body).includes('    at '));
  });

  test('details 为 null 时不出现', async () => {
    assert.equal('details' in (await errorResponse('x', 400).json()).error, false);
  });

  test('错误响应不可缓存', () => {
    assert.match(errorResponse('x', 500).headers.get('Cache-Control'), /no-store/);
  });
});

describe('成功响应', () => {
  test('jsonResponse 不包装 handler 的自定义结构', async () => {
    // /user/profile 等接口返回的是 { profile: ... } 这类形状，
    // 被包进 { success, data } 会直接打断 hub 的解析
    const response = jsonResponse({ profile: { bio: 'x' } });
    assert.deepEqual(await response.json(), { profile: { bio: 'x' } });
  });

  test('JSON 响应带 nosniff', () => {
    assert.equal(jsonResponse({}).headers.get('X-Content-Type-Options'), 'nosniff');
  });

  test('successResponse 形状保持', async () => {
    assert.deepEqual(await successResponse({ n: 1 }, 'done').json(), {
      success: true,
      data: { n: 1 },
      message: 'done',
    });
    assert.deepEqual(await successResponse({ n: 1 }).json(), { success: true, data: { n: 1 } });
  });
});

describe('CORS', () => {
  test('方法集保持 gateway 原本的收窄值', () => {
    // worker-kit 默认还包含 DELETE，gateway 不暴露任何 DELETE 接口
    assert.equal(CORS_HEADERS['Access-Control-Allow-Methods'], 'GET, HEAD, POST, PUT, OPTIONS');
  });

  test('OPTIONS 返回 204', () => {
    const response = handleCORS(new Request('https://api.example/x', { method: 'OPTIONS' }));
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET, HEAD, POST, PUT, OPTIONS');
  });

  test('非 OPTIONS 返回 null', () => {
    assert.equal(handleCORS(new Request('https://api.example/x')), null);
  });

  test('addCORSHeaders 保留状态与原有头', () => {
    const wrapped = addCORSHeaders(new Response('x', { status: 201, headers: { 'X-Keep': '1' } }));
    assert.equal(wrapped.status, 201);
    assert.equal(wrapped.headers.get('X-Keep'), '1');
    assert.equal(wrapped.headers.get('Access-Control-Allow-Origin'), '*');
  });
});

describe('authenticate', () => {
  test('缺 AUTH_DB binding 时返回 null 而不抛', async () => {
    const request = new Request('https://x/', { headers: { Authorization: 'Bearer t' } });
    assert.equal(await authenticate(request, {}), null);
  });

  test('无 Authorization 头时返回 null', async () => {
    assert.equal(await authenticate(new Request('https://x/'), {}), null);
  });
});

describe('worker.fetch 路由', () => {
  test('/health 返回 200 且带 CORS', async () => {
    const response = await worker.fetch(new Request('https://api.example/health'), {}, ctx);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal((await response.json()).service, 'gateway');
  });

  test('HEAD /health 无 body', async () => {
    const response = await worker.fetch(
      new Request('https://api.example/health', { method: 'HEAD' }),
      {},
      ctx,
    );
    assert.equal(response.status, 200);
    assert.equal(await response.text(), '');
  });

  test('/health 不接受 POST', async () => {
    const response = await worker.fetch(
      new Request('https://api.example/health', { method: 'POST' }),
      {},
      ctx,
    );
    assert.equal(response.status, 405);
    assert.equal((await response.json()).error.code, 'method_not_allowed');
  });

  test('未知路由返回统一 404 信封', async () => {
    const response = await worker.fetch(new Request('https://api.example/nope'), {}, ctx);
    assert.equal(response.status, 404);
    const body = await response.json();
    assert.equal(body.error.code, 'not_found');
    assert.equal(body.message, 'Not Found');
  });

  test('OPTIONS 预检返回 204', async () => {
    const response = await worker.fetch(
      new Request('https://api.example/user/stats', { method: 'OPTIONS' }),
      {},
      ctx,
    );
    assert.equal(response.status, 204);
  });
});
