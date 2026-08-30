const DEFAULT_TTL_MS = 30000;

const memoryCache = new Map();

function cacheKey(url, params) {
  return `${url}::${JSON.stringify(params || {})}`;
}

export function getCached(url, params) {
  const key = cacheKey(url, params);
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
}

export function setCached(url, params, value, ttlMs = DEFAULT_TTL_MS) {
  memoryCache.set(cacheKey(url, params), {
    value,
    expiresAt: Date.now() + ttlMs,
  });
  return value;
}

export function clearApiCache(prefix = "") {
  if (!prefix) {
    memoryCache.clear();
    return;
  }
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) memoryCache.delete(key);
  }
}

export async function cachedGet(axiosInstance, url, config = {}, ttlMs = DEFAULT_TTL_MS) {
  const params = config.params || {};
  if (ttlMs > 0) {
    const hit = getCached(url, params);
    if (hit) return { data: hit, fromCache: true };
  }

  const response = await axiosInstance.get(url, config);
  if (ttlMs > 0) {
    setCached(url, params, response.data, ttlMs);
  }
  return { ...response, fromCache: false };
}
