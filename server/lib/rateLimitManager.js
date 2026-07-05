/**
 * FIX #3: Safe rate limiting with Redis primary, in-memory fallback.
 * 
 * Problem: Module-level in-memory stores don't share state across Vercel instances.
 * Each instance has its own rate limit counter, so a user can make N*instances requests.
 * 
 * Solution:
 * 1. Use Redis as primary (persisted, shared across instances)
 * 2. In-memory fallback only for development/Redis failures
 * 3. Log warnings when Redis is unavailable in production
 */

const redis = require('redis');

const RATE_LIMIT_WINDOW_SECS = Number.parseInt(process.env.RATE_LIMIT_WINDOW || '60');
const MAX_REQUESTS_PER_WINDOW = Number.parseInt(process.env.RATE_LIMIT_MAX || '60');

class RateLimitManager {
  constructor() {
    this.redisClient = null;
    this.inMemoryStore = new Map(); // Fallback only
    this.isProduction = process.env.ENV === 'production';
    this.initRedis();
  }

  async initRedis() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      if (this.isProduction) {
        console.warn(
          '[RateLimit] WARNING: REDIS_URL not set in production. ' +
          'Rate limiting will NOT work across instances. Set REDIS_URL to fix.'
        );
      }
      return;
    }

    try {
      this.redisClient = redis.createClient({ url: redisUrl });
      await this.redisClient.connect();
      console.log('[RateLimit] Connected to Redis for distributed rate limiting');
    } catch (err) {
      console.error('[RateLimit] Failed to connect to Redis:', err.message);
      if (this.isProduction) {
        console.error(
          '[RateLimit] CRITICAL: Redis failed in production. ' +
          'Rate limiting is NOT working. Requests are NOT limited across instances.'
        );
      }
    }
  }

  /**
   * Check if a request from userId exceeds the rate limit.
   * Returns { allowed: boolean, remaining: number, resetAfterSecs: number }
   */
  async checkLimit(userId) {
    const key = `rate_limit:${userId}`;
    const now = Date.now();

    // Try Redis first
    if (this.redisClient) {
      try {
        const count = await this.redisClient.incr(key);
        if (count === 1) {
          await this.redisClient.expire(key, RATE_LIMIT_WINDOW_SECS);
        }
        const ttl = await this.redisClient.ttl(key);
        const allowed = count <= MAX_REQUESTS_PER_WINDOW;
        return {
          allowed,
          remaining: Math.max(0, MAX_REQUESTS_PER_WINDOW - count),
          resetAfterSecs: ttl > 0 ? ttl : RATE_LIMIT_WINDOW_SECS,
        };
      } catch (err) {
        console.error('[RateLimit] Redis error, falling back to in-memory:', err.message);
        if (this.isProduction) {
          console.error('[RateLimit] ALERT: Redis failed in production!');
        }
        // Fall through to in-memory fallback
      }
    }

    // In-memory fallback (not suitable for production with multiple instances)
    if (this.isProduction && !this.redisClient) {
      // In production without Redis, allow all requests but log warning
      console.warn('[RateLimit] Rate limiting DISABLED (no Redis). Request allowed.');
      return {
        allowed: true,
        remaining: MAX_REQUESTS_PER_WINDOW,
        resetAfterSecs: RATE_LIMIT_WINDOW_SECS,
      };
    }

    // Development: use in-memory store
    let entry = this.inMemoryStore.get(key);
    if (!entry || now - entry.timestamp > RATE_LIMIT_WINDOW_SECS * 1000) {
      entry = { count: 0, timestamp: now };
    }
    entry.count += 1;
    this.inMemoryStore.set(key, entry);

    const allowed = entry.count <= MAX_REQUESTS_PER_WINDOW;
    return {
      allowed,
      remaining: Math.max(0, MAX_REQUESTS_PER_WINDOW - entry.count),
      resetAfterSecs: RATE_LIMIT_WINDOW_SECS,
    };
  }
}

module.exports = new RateLimitManager();
