import redis from './redis';

const PREFIX = 'jti:blacklisted:';

export async function isTokenBlacklisted(jti: string): Promise<boolean> {
  if (!redis || redis.status !== "ready") {
    return false;
  }
  try {
    const result = await redis.get(`${PREFIX}${jti}`);
    return result === '1';
  } catch {
    return false;
  }
}

export async function blacklistToken(jti: string, ttlSeconds: number): Promise<void> {
  if (!redis || redis.status !== "ready") return;
  try {
    await redis.setex(`${PREFIX}${jti}`, ttlSeconds, '1');
  } catch {
    // Redis unavailable — degrade gracefully
  }
}

export async function removeBlacklist(jti: string): Promise<void> {
  if (!redis || redis.status !== "ready") return;
  try {
    await redis.del(`${PREFIX}${jti}`);
  } catch {
    // silent
  }
}
