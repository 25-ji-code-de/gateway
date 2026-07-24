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

// 学习相关 API（占位）
// 学习数据通过 /user/sync?project=25ji 与 /user/events 上报；此处预留专用 REST。

import { errorResponse, jsonResponse } from '../../utils/response.js';

export async function handleStudy(request, env, ctx, user) {
  if (request.method === 'GET') {
    return jsonResponse({
      service: 'study',
      status: 'not_implemented',
      message: 'Study REST API is reserved. Use /user/sync?project=25ji and /user/events.',
      related: {
        '25ji': 'https://25ji.nightcord.de5.net',
        sync: '/user/sync?project=25ji',
        events: '/user/events',
      },
    }, 501);
  }
  return errorResponse(
    'Study API not implemented; use /user/sync?project=25ji and /user/events',
    501,
  );
}
