import redis from '../lib/redis';

const DEFAULT_TTL = 3600; // 1 hour
let _warned = false;

function warnOnce(): void {
  if (!_warned) {
    _warned = true;
    console.warn('[Cache] Redis unavailable - caching disabled. Check REDIS_URL.');
  }
}

// Races Redis operations with a timeout to prevent TCP half-open hanging
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 2000): Promise<T> {
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Redis operation timed out')), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

export async function getCachedStats<T>(key: string): Promise<T | null> {
  if (!redis || redis.status !== "ready") {
    warnOnce();
    return null;
  }
  
  try {
    const cached = await withTimeout(redis.get(key), 300);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (error) {
    console.error('Redis get error/timeout:', error);
  }
  return null;
}

export async function setCachedStats<T>(key: string, data: T, ttl: number = DEFAULT_TTL): Promise<void> {
  if (!redis || redis.status !== "ready") return;
  
  try {
    await withTimeout(redis.setex(key, ttl, JSON.stringify(data)), 300);
  } catch (error) {
    console.error('Redis set error/timeout:', error);
  }
}

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    return await getCachedStats<T>(key);
  } catch {
    return null;
  }
}

export async function setCache<T>(key: string, data: T, ttl: number = DEFAULT_TTL): Promise<void> {
  try {
    await setCachedStats<T>(key, data, ttl);
  } catch {
    // silent fail
  }
}

export function getCacheKey(platform: string, username: string): string {
  return `platform:${platform}:${username.toLowerCase()}`;
}

export async function delCache(key: string): Promise<void> {
  if (!redis || redis.status !== "ready") return;
  try {
    await withTimeout(redis.del(key), 300);
  } catch (error) {
    // silent fallback
  }
}

export async function delCacheByPattern(pattern: string): Promise<void> {
  if (!redis || redis.status !== "ready") return;
  try {
    let cursor = '0';
    const batchSize = 100;
    do {
      const result = await withTimeout(redis.scan(cursor, 'MATCH', pattern, 'COUNT', batchSize), 400);
      cursor = result[0];
      const keys = result[1];
      if (keys.length > 0) {
        await withTimeout(redis.del(...keys), 300);
      }
    } while (cursor !== '0');
  } catch (error) {
    // silent fallback
  }
}

export async function cacheWithFallback<T>(key: string, fetchFn: () => Promise<T>, ttl: number = DEFAULT_TTL): Promise<T> {
  const cached = await getCached<T>(key);
  if (cached !== null) return cached;
  const data = await fetchFn();
  await setCache(key, data, ttl);
  return data;
}

export async function publishEvent(channel: string, event: string, payload: Record<string, unknown>): Promise<void> {
  if (!redis || redis.status !== "ready") return;
  try {
    await redis.publish(channel, JSON.stringify({ event, payload, timestamp: new Date().toISOString() }));
  } catch (error) {
    // silent fallback
  }
}
