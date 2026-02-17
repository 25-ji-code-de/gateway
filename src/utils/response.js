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

// 响应工具函数

export function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

export function errorResponse(message, status = 500, details = null) {
  const body = {
    error: true,
    message,
  };

  if (details) {
    body.details = details;
  }

  return jsonResponse(body, status, {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  });
}

export function successResponse(data, message = null) {
  const body = {
    success: true,
    data,
  };

  if (message) {
    body.message = message;
  }

  return jsonResponse(body);
}
