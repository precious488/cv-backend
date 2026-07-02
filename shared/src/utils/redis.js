"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheKeys = void 0;
exports.getRedisClient = getRedisClient;
exports.cacheAside = cacheAside;
exports.invalidateCache = invalidateCache;
exports.invalidateCachePattern = invalidateCachePattern;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("./logger");
let client = null;
function getRedisClient() {
    if (!client) {
        const url = process.env.REDIS_URL;
        if (!url)
            throw new Error('REDIS_URL env var is required');
        client = new ioredis_1.default(url, {
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            enableReadyCheck: true,
        });
        client.on('connect', () => logger_1.logger.info('Redis connected'));
        client.on('error', (err) => logger_1.logger.error({ err }, 'Redis error'));
        client.on('reconnecting', () => logger_1.logger.warn('Redis reconnecting'));
    }
    return client;
}
// ─── Cache-Aside (Lazy Loading) ───────────────────────────────
/**
 * Try cache first; on miss, call loader, store result, return it.
 * TTL is in seconds (default 5 min).
 */
async function cacheAside(key, loader, ttlSeconds = 300) {
    const redis = getRedisClient();
    try {
        const cached = await redis.get(key);
        if (cached) {
            logger_1.logger.debug({ key }, 'Cache HIT');
            return JSON.parse(cached);
        }
    }
    catch (err) {
        logger_1.logger.warn({ err, key }, 'Redis GET failed, falling through to DB');
    }
    logger_1.logger.debug({ key }, 'Cache MISS — loading from source');
    const data = await loader();
    try {
        await redis.setex(key, ttlSeconds, JSON.stringify(data));
    }
    catch (err) {
        logger_1.logger.warn({ err, key }, 'Redis SET failed (non-fatal)');
    }
    return data;
}
// ─── Write-Through / Cache Invalidation ──────────────────────
/** Invalidate one or more cache keys after a mutation. */
async function invalidateCache(...keys) {
    if (keys.length === 0)
        return;
    const redis = getRedisClient();
    try {
        await redis.del(...keys);
        logger_1.logger.debug({ keys }, 'Cache invalidated');
    }
    catch (err) {
        logger_1.logger.warn({ err, keys }, 'Redis DEL failed (non-fatal)');
    }
}
/** Invalidate all keys matching a pattern (use carefully). */
async function invalidateCachePattern(pattern) {
    const redis = getRedisClient();
    try {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
            await redis.del(...keys);
            logger_1.logger.debug({ pattern, count: keys.length }, 'Cache pattern invalidated');
        }
    }
    catch (err) {
        logger_1.logger.warn({ err, pattern }, 'Redis pattern DEL failed (non-fatal)');
    }
}
// ─── Key builders (consistent naming) ────────────────────────
exports.cacheKeys = {
    user: (userId) => `user:${userId}`,
    profile: (userId) => `profile:${userId}`,
    cv: (cvId) => `cv:${cvId}`,
    cvList: (userId) => `cv:list:${userId}`,
    atsScore: (cvId, jobDescHash) => `ats:${cvId}:${jobDescHash}`,
    rateLimit: (ip, route) => `rl:${ip}:${route}`,
};
