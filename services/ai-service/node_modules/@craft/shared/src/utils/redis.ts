import Redis from 'ioredis';
import { logger } from './logger';

let client: Redis | null = null;

export function getRedisClient(): Redis {
  if (!client) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error('REDIS_URL env var is required');

    client = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableReadyCheck: true,
    });

    client.on('connect', () => logger.info('Redis connected'));
    client.on('error', (err) => logger.error({ err }, 'Redis error'));
    client.on('reconnecting', () => logger.warn('Redis reconnecting'));
  }
  return client;
}

// ─── Cache-Aside (Lazy Loading) ───────────────────────────────
/**
 * Try cache first; on miss, call loader, store result, return it.
 * TTL is in seconds (default 5 min).
 */
export async function cacheAside<T>(
  key: string,
  loader: () => Promise<T>,
  ttlSeconds = 300
): Promise<T> {
  const redis = getRedisClient();

  try {
    const cached = await redis.get(key);
    if (cached) {
      logger.debug({ key }, 'Cache HIT');
      return JSON.parse(cached) as T;
    }
  } catch (err) {
    logger.warn({ err, key }, 'Redis GET failed, falling through to DB');
  }

  logger.debug({ key }, 'Cache MISS — loading from source');
  const data = await loader();

  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(data));
  } catch (err) {
    logger.warn({ err, key }, 'Redis SET failed (non-fatal)');
  }

  return data;
}

// ─── Write-Through / Cache Invalidation ──────────────────────
/** Invalidate one or more cache keys after a mutation. */
export async function invalidateCache(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const redis = getRedisClient();
  try {
    await redis.del(...keys);
    logger.debug({ keys }, 'Cache invalidated');
  } catch (err) {
    logger.warn({ err, keys }, 'Redis DEL failed (non-fatal)');
  }
}

/** Invalidate all keys matching a pattern (use carefully). */
export async function invalidateCachePattern(pattern: string): Promise<void> {
  const redis = getRedisClient();
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.debug({ pattern, count: keys.length }, 'Cache pattern invalidated');
    }
  } catch (err) {
    logger.warn({ err, pattern }, 'Redis pattern DEL failed (non-fatal)');
  }
}

// ─── Key builders (consistent naming) ────────────────────────
export const cacheKeys = {
  user: (userId: string) => `user:${userId}`,
  profile: (userId: string) => `profile:${userId}`,
  cv: (cvId: string) => `cv:${cvId}`,
  cvList: (userId: string) => `cv:list:${userId}`,
  atsScore: (cvId: string, jobDescHash: string) => `ats:${cvId}:${jobDescHash}`,
  rateLimit: (ip: string, route: string) => `rl:${ip}:${route}`,
};
