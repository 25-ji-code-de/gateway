// 用户资料 API
// 只管理扩展资料（bio），基本资料（display_name, avatar_url）由 SEKAI Pass 管理

import { jsonResponse, errorResponse } from '../../utils/response.js';

/**
 * 获取用户扩展资料
 * GET /user/profile
 */
export async function getUserProfile(request, env, user) {
  try {
    const result = await env.DB.prepare(`
      SELECT bio, created_at, updated_at
      FROM user_profiles
      WHERE user_id = ?
    `).bind(user.id).first();

    if (!result) {
      // 用户首次访问，返回空资料
      return jsonResponse({
        user_id: user.id,
        bio: null,
        created_at: null,
        updated_at: null
      });
    }

    return jsonResponse({
      user_id: user.id,
      bio: result.bio,
      created_at: result.created_at,
      updated_at: result.updated_at
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    return errorResponse('Failed to get user profile', 500);
  }
}

/**
 * 更新用户扩展资料
 * PUT /user/profile
 * Body: { bio? }
 */
export async function updateUserProfile(request, env, user) {
  try {
    const body = await request.json();
    const { bio } = body;

    // 验证字段
    if (bio !== undefined && bio !== null) {
      if (typeof bio !== 'string' || bio.length > 500) {
        return errorResponse('bio must be a string with max 500 characters', 400);
      }
    } else {
      return errorResponse('bio field is required', 400);
    }

    const now = Date.now();

    // 检查用户资料是否存在
    const existing = await env.DB.prepare(`
      SELECT user_id FROM user_profiles WHERE user_id = ?
    `).bind(user.id).first();

    if (existing) {
      // 更新现有资料
      await env.DB.prepare(`
        UPDATE user_profiles
        SET bio = ?, updated_at = ?
        WHERE user_id = ?
      `).bind(bio, now, user.id).run();
    } else {
      // 创建新资料
      await env.DB.prepare(`
        INSERT INTO user_profiles (user_id, bio, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `).bind(user.id, bio, now, now).run();
    }

    // 返回更新后的资料
    return getUserProfile(request, env, user);
  } catch (error) {
    console.error('Update user profile error:', error);
    return errorResponse('Failed to update user profile', 500);
  }
}
