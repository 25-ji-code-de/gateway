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

// 聊天相关 API（占位）
// 实时聊天走 Nightcord WebSocket 与 Nako 独立服务；此处预留聚合端点。

import { errorResponse, jsonResponse } from '../../utils/response.js';

export async function handleChat(request, env, ctx, user) {
  if (request.method === 'GET') {
    return jsonResponse({
      service: 'chat',
      status: 'not_implemented',
      message: 'Chat REST API is reserved. Use Nightcord WebSocket or Nako /api/chat.',
      related: {
        nightcord: 'https://nightcord.de5.net',
        nako: 'https://nako.nightcord.de5.net',
      },
    }, 501);
  }
  return errorResponse(
    'Chat API not implemented; use Nightcord WebSocket or Nako /api/chat',
    501,
  );
}
