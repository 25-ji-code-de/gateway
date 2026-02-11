// 认证中间件 - 验证 SEKAI Pass 的 access token

export async function authenticate(request) {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    // 调用 SEKAI Pass 的 userinfo 端点验证 token
    const response = await fetch('https://id.nightcord.de5.net/oauth/userinfo', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      return null;
    }

    const userInfo = await response.json();
    return {
      id: userInfo.sub,
      username: userInfo.username,
      email: userInfo.email
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}
