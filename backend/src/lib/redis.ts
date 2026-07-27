import Redis from "ioredis";
import dotenv from "dotenv";
import * as dns from "dns";

dotenv.config();

const redisUrl = process.env.REDIS_URL;

/**
 * Singleton Redis client for cloud-ready connectivity.
 * Uses REDIS_URL for standard production compatibility (e.g. Upstash, Heroku, Azure).
 * Gracefully degrades if Redis is unreachable.
 */
function createRedisClient(url: string): Redis | null {
  try {
    const parsed = new URL(url);
    // Test DNS resolution before attempting connection
    dns.resolve(parsed.hostname, (err) => {
      if (err) {
        console.warn(`⚠️ Redis host ${parsed.hostname} not resolvable. Background tasks will be disabled.`);
      }
    });
    const client = new Redis(url, {
      connectTimeout: 800, // Max 800ms connection timeout limit
      maxRetriesPerRequest: null,
      enableOfflineQueue: false, // Fail fast when disconnected instead of hanging
      retryStrategy: (times: number) => {
        if (times > 3) return null; // Stop reconnect retries quickly if offline
        return Math.min(times * 150, 1000);
      },
      lazyConnect: true,
      keepAlive: 10000,
    });
    client.on("error", (err) => {
      console.warn("⚠️ Redis connection error (background tasks degraded):", err.message);
    });
    return client;
  } catch {
    console.warn("⚠️ Invalid REDIS_URL. Background tasks will be disabled.");
    return null;
  }
}

const redis = redisUrl ? createRedisClient(redisUrl) : null;

if (redis) {
  redis.connect().catch((err) => {
    console.warn("⚠️ Redis connection failed (background tasks degraded):", err.message);
  });
}

export default redis;
