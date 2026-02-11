// 聊天相关 API（未来实现）

import { errorResponse } from '../../utils/response.js';

export async function handleChat(request, env, ctx, user) {
  return errorResponse('Chat API not implemented yet', 501);
}
