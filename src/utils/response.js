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
