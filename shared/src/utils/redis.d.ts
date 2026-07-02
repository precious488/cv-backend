import Redis from 'ioredis';
export declare function getRedisClient(): Redis;
/**
 * Try cache first; on miss, call loader, store result, return it.
 * TTL is in seconds (default 5 min).
 */
export declare function cacheAside<T>(key: string, loader: () => Promise<T>, ttlSeconds?: number): Promise<T>;
/** Invalidate one or more cache keys after a mutation. */
export declare function invalidateCache(...keys: string[]): Promise<void>;
/** Invalidate all keys matching a pattern (use carefully). */
export declare function invalidateCachePattern(pattern: string): Promise<void>;
export declare const cacheKeys: {
    user: (userId: string) => string;
    profile: (userId: string) => string;
    cv: (cvId: string) => string;
    cvList: (userId: string) => string;
    atsScore: (cvId: string, jobDescHash: string) => string;
    rateLimit: (ip: string, route: string) => string;
};
