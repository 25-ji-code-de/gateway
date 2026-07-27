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

// 认证中间件 —— 实现已移至 @25-ji-code-de/sekai-worker-kit。
//
// 此前这个文件与 nako/src/middleware/auth.ts 是同一个函数的 JS / TS
// 两份逐字拷贝（相同的 SQL、相同的 MAX_TOKEN_LEN、相同的过期判断）。
//
// 行为与迁移前完全一致：任何失败路径返回 null，不抛异常。
// 返回值新增了 clientId 与 scopes 两个字段（此前 access_tokens.scope
// 与 client_id 从未被读取）—— 新增字段不影响现有调用点。
//
// 想收紧 scope 时传第三个参数：
//   authenticate(request, env, { requireScopes: ['profile'] })

export { authenticate, extractBearerToken, MAX_TOKEN_LEN } from '@25-ji-code-de/sekai-worker-kit';
