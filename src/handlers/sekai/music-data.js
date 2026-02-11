// SEKAI 音乐数据聚合

import { CONFIG, DATA_SOURCES } from '../../config/constants.js';
import { jsonResponse, errorResponse } from '../../utils/response.js';
import { createCacheKey, getCachedResponse, setCachedResponse } from '../../utils/cache.js';
import { logCacheEvent } from '../../utils/analytics.js';

export async function handleMusicData(request, env, ctx) {
  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get('refresh') === '1';
  const cache = caches.default;
  const cacheKey = createCacheKey(url, '/sekai/music_data.json');

  // 第一层：边缘缓存
  if (!forceRefresh) {
    const cached = await getCachedResponse(cache, cacheKey);
    if (cached) {
      logCacheEvent('music_data', true, 'edge');
      return cached;
    }
  }

  // 第二层：R2 缓存
  if (!forceRefresh) {
    const r2Result = await tryR2Cache(env, ctx, cache, cacheKey);
    if (r2Result) {
      logCacheEvent('music_data', true, 'r2');
      return r2Result;
    }
  }

  // 第三层：源站获取
  logCacheEvent('music_data', false, 'origin');
  return await fetchAndCache(env, ctx, cache, cacheKey);
}

async function tryR2Cache(env, ctx, cache, cacheKey) {
  const r2Object = await env.BUCKET.get(CONFIG.R2_KEY);
  if (!r2Object) return null;

  const metadata = r2Object.customMetadata || {};
  const cachedAt = parseInt(metadata.cachedAt || '0');
  const age = Date.now() - cachedAt;

  // 超过 STALE_TTL，缓存完全过期
  if (age > CONFIG.STALE_TTL * 1000) {
    return null;
  }

  const body = await r2Object.text();
  const remainingFresh = Math.max(0, CONFIG.R2_TTL - Math.floor(age / 1000));

  const response = new Response(body, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${Math.min(remainingFresh, CONFIG.EDGE_TTL)}`,
      'X-Cache': 'HIT',
      'X-Age': Math.floor(age / 1000).toString(),
    },
  });

  // 写入边缘缓存
  await setCachedResponse(cache, cacheKey, response, ctx);

  // 超过新鲜期一半，后台静默刷新
  if (age > (CONFIG.R2_TTL * 1000) / 2) {
    ctx.waitUntil(backgroundRefresh(env, cache, cacheKey));
  }

  return response;
}

async function backgroundRefresh(env, cache, cacheKey) {
  try {
    const data = await fetchMergedData();
    if (data) {
      await storeToR2(env, data);
      await storeToEdge(cache, cacheKey, data);
    }
  } catch (e) {
    console.error('Background refresh failed:', e.message);
  }
}

async function fetchAndCache(env, ctx, cache, cacheKey) {
  try {
    const data = await fetchMergedData();

    // 并行写入两级缓存
    ctx.waitUntil(Promise.all([
      storeToR2(env, data),
      storeToEdge(cache, cacheKey, data),
    ]));

    return new Response(data.json, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${CONFIG.EDGE_TTL}`,
        'X-Cache': 'MISS',
        'X-Count': data.count.toString(),
      },
    });
  } catch (error) {
    // 降级：尝试返回旧缓存
    const stale = await env.BUCKET.get(CONFIG.R2_KEY);
    if (stale) {
      return new Response(stale.body, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=10',
          'X-Cache': 'STALE-ERROR',
        },
      });
    }

    return errorResponse('Service temporarily unavailable', 503, error.message);
  }
}

async function fetchMergedData() {
  const [musicsResp, vocalsResp, titlesResp] = await Promise.all([
    fetch(DATA_SOURCES.musics),
    fetch(DATA_SOURCES.musicVocals),
    fetch(DATA_SOURCES.musicTitles),
  ]);

  if (!musicsResp.ok || !vocalsResp.ok || !titlesResp.ok) {
    throw new Error(`Upstream failed: musics=${musicsResp.status}, vocals=${vocalsResp.status}, titles=${titlesResp.status}`);
  }

  const [musics, vocals, titles] = await Promise.all([
    musicsResp.json(),
    vocalsResp.json(),
    titlesResp.json(),
  ]);

  // 构建 vocals 索引
  const vocalsMap = new Map();
  for (const v of vocals) {
    if (!vocalsMap.has(v.musicId)) {
      vocalsMap.set(v.musicId, []);
    }
    vocalsMap.get(v.musicId).push({
      i: v.id,
      t: v.musicVocalType,
      c: v.caption,
      a: v.assetbundleName,
      ch: (v.characters || []).map(c => [c.characterId, c.characterType]),
    });
  }

  // 合并数据（精简字段）
  const merged = musics.map(m => ({
    i: m.id,
    t: m.title,
    p: m.pronunciation,
    tz: titles[m.id] || null,
    c: m.composer,
    l: m.lyricist,
    a: m.assetbundleName,
    f: m.fillerSec,
    v: vocalsMap.get(m.id) || [],
  }));

  // 按 ID 排序
  merged.sort((a, b) => a.i - b.i);

  const now = Date.now();
  const result = {
    v: 3,
    t: now,
    n: merged.length,
    m: merged,
  };

  const json = JSON.stringify(result);

  return { json, count: merged.length, timestamp: now };
}

async function storeToR2(env, data) {
  await env.BUCKET.put(CONFIG.R2_KEY, data.json, {
    httpMetadata: {
      contentType: 'application/json',
    },
    customMetadata: {
      cachedAt: data.timestamp.toString(),
      count: data.count.toString(),
    },
  });
}

async function storeToEdge(cache, cacheKey, data) {
  const response = new Response(data.json, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${CONFIG.EDGE_TTL}`,
      'X-Cache': 'REFRESH',
    },
  });
  await cache.put(cacheKey, response);
}
