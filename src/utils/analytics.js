// 分析和监控工具

/**
 * 记录请求指标到 Cloudflare Analytics
 * @param {ExecutionContext} ctx - Worker 执行上下文
 * @param {Request} request - 请求对象
 * @param {Response} response - 响应对象
 * @param {number} duration - 请求处理时长（毫秒）
 * @param {Object} metadata - 额外的元数据
 */
export function logMetrics(ctx, request, response, duration, metadata = {}) {
  try {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const status = response.status;
    const country = request.cf?.country || 'UNKNOWN';
    const cacheStatus = response.headers.get('CF-Cache-Status') || 'NONE';

    // 构造日志对象
    const logData = {
      timestamp: new Date().toISOString(),
      method,
      path,
      status,
      duration,
      country,
      cacheStatus,
      ...metadata,
    };

    // 输出到控制台（可通过 wrangler tail 查看）
    console.log(JSON.stringify(logData));

    // 如果有 Analytics Engine 绑定，写入数据点
    // 注意：需要在 wrangler.toml 中配置 analytics_engine_datasets
    // ctx.waitUntil(
    //   env.ANALYTICS?.writeDataPoint({
    //     blobs: [method, path, country, cacheStatus],
    //     doubles: [duration, status],
    //     indexes: [path],
    //   })
    // );
  } catch (error) {
    // 监控本身不应该影响主流程
    console.error('Failed to log metrics:', error);
  }
}

/**
 * 记录错误日志
 * @param {string} context - 错误上下文
 * @param {Error} error - 错误对象
 * @param {Object} extra - 额外信息
 */
export function logError(context, error, extra = {}) {
  const errorLog = {
    timestamp: new Date().toISOString(),
    level: 'ERROR',
    context,
    message: error.message,
    stack: error.stack,
    ...extra,
  };

  console.error(JSON.stringify(errorLog));
}

/**
 * 记录缓存命中/未命中
 * @param {string} key - 缓存键
 * @param {boolean} hit - 是否命中
 * @param {string} source - 缓存来源（edge/r2）
 */
export function logCacheEvent(key, hit, source) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    type: 'CACHE',
    key,
    hit,
    source,
  }));
}
