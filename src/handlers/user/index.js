// 用户相关 API（未来实现）

import { errorResponse } from '../../utils/response.js';

export async function handleUser(request, env, ctx, user) {
  return errorResponse('User API not implemented yet', 501);
}
