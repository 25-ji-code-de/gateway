// 用户资料 API

import { jsonResponse, errorResponse } from '../../utils/response.js';

/**
 * 获取用户资料
 * GET /user/profile
 */
export async function getUserProfile(request, env, user) {
  try {
    const result = await env.DB.prepare(`
      SELECT display_name, avatar_url, bio, created_at, updated_at
      FROM user_profiles
      WHERE user_id = ?
    `).bind(user.id).first();

    if (!result) {
      // 用户首次访问，返回空资料
      return jsonResponse({
        user_id: user.id,
        display_name: null,
        avatar_url: null,
        bio: null,
        created_at: null,
        updated_at: null
      });
    }

    return jsonResponse({
      user_id: user.id,
      display_name: result.display_name,
      avatar_url: result.avatar_url,
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
 * 更新用户资料
 * PUT /user/profile
 * Body: { display_name?, avatar_url?, bio? }
 */
export async function updateUserProfile(request, env, user) {
  try {
    const body = await request.json();
    const { display_name, avatar_url, bio } = body;

    // 验证字段长度
    if (display_name !== undefined && display_name !== null) {
      if (typeof display_name !== 'string' || display_name.length > 50) {
        return errorResponse('display_name must be a string with max 50 characters', 400);
      }
    }

    if (avatar_url !== undefined && avatar_url !== null) {
      if (typeof avatar_url !== 'string' || avatar_url.length > 500) {
        return errorResponse('avatar_url must be a string with max 500 characters', 400);
      }
    }

    if (bio !== undefined && bio !== null) {
      if (typeof bio !== 'string' || bio.length > 500) {
        return errorResponse('bio must be a string with max 500 characters', 400);
      }
    }

    const now = Date.now();

    // 检查用户资料是否存在
    const existing = await env.DB.prepare(`
      SELECT user_id FROM user_profiles WHERE user_id = ?
    `).bind(user.id).first();

    if (existing) {
      // 更新现有资料
      const updates = [];
      const params = [];

      if (display_name !== undefined) {
        updates.push('display_name = ?');
        params.push(display_name);
      }
      if (avatar_url !== undefined) {
        updates.push('avatar_url = ?');
        params.push(avatar_url);
      }
      if (bio !== undefined) {
        updates.push('bio = ?');
        params.push(bio);
      }

      if (updates.length === 0) {
        return errorResponse('No fields to update', 400);
      }

      updates.push('updated_at = ?');
      params.push(now);
      params.push(user.id);

      await env.DB.prepare(`
        UPDATE user_profiles
        SET ${updates.join(', ')}
        WHERE user_id = ?
      `).bind(...params).run();
    } else {
      // 创建新资料
      await env.DB.prepare(`
        INSERT INTO user_profiles (user_id, display_name, avatar_url, bio, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        user.id,
        display_name || null,
        avatar_url || null,
        bio || null,
        now,
        now
      ).run();
    }

    // 返回更新后的资料
    return getUserProfile(request, env, user);
  } catch (error) {
    console.error('Update user profile error:', error);
    return errorResponse('Failed to update user profile', 500);
  }
}
