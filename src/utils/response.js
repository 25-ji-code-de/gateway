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

// 响应工具函数 —— 现在是 @25-ji-code-de/sekai-worker-kit 之上的适配层。
//
// 保留 gateway 原有的调用签名（约 45 个调用点无需改动），只让**错误**的
// 线路格式统一到生态信封。成功响应的形状**不变** —— 各 handler 直接用
// jsonResponse 返回自定义结构（如 { profile }、{ stats }），hub 与 25ji
// 读的是这些具体字段，改了会断。

import {
  jsonResponse as kitJsonResponse,
  errorResponse as kitErrorResponse,
} from '@25-ji-code-de/sekai-worker-kit';

export { JSON_HEADERS } from '@25-ji-code-de/sekai-worker-kit';

/**
 * HTTP 状态码 → 机器可读错误码。
 *
 * gateway 的调用点历史上只传人类可读的 message，没有 code。为了让新的
 * 结构化信封有意义的 `error.code`，这里按状态码推导。调用点想给更精确的
 * code 时，可以显式传第四个参数。
 */
const CODE_BY_STATUS = {
  400: 'invalid_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  405: 'method_not_allowed',
  413: 'payload_too_large',
  429: 'rate_limited',
  500: 'server_error',
  502: 'bad_gateway',
  503: 'service_unavailable',
};

/**
 * @param {unknown} data
 * @param {number} [status]
 * @param {Record<string, string>} [headers]
 * @returns {Response}
 */
export function jsonResponse(data, status = 200, headers = {}) {
  return kitJsonResponse(data, status, headers);
}

/**
 * 错误响应。
 *
 * 线路格式为 `{ success: false, error: { code, message, details? }, message }`。
 * 顶层 `message` 是给 hub / 25ji 现有 `API.request()` 解析用的兼容镜像。
 *
 * @param {string} message 面向人的描述
 * @param {number} [status]
 * @param {unknown} [details] 传 Error 时只取 .message，不泄 stack
 * @param {string} [code] 覆盖按状态码推导出的错误码
 * @returns {Response}
 */
export function errorResponse(message, status = 500, details = null, code = undefined) {
  return kitErrorResponse(code ?? CODE_BY_STATUS[status] ?? 'error', message, status, {
    details,
  });
}

/**
 * 成功响应 `{ success: true, data, message? }`。
 * @param {unknown} data
 * @param {string|null} [message]
 * @returns {Response}
 */
export function successResponse(data, message = null) {
  const body = { success: true, data };
  if (message) body.message = message;
  return kitJsonResponse(body);
}
