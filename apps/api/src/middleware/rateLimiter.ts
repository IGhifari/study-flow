import { Request, Response, NextFunction } from 'express';
import rateLimit, { Store, ClientRateLimitInfo, ipKeyGenerator } from 'express-rate-limit';
import crypto from 'node:crypto';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';

/**
 * Atomic Lua script for express-rate-limit Store increment.
 *
 * KEYS[1]: fullKey - Rate limiter Redis key
 * ARGV[1]: window_ms - Duration of the rate limit window in milliseconds
 *
 * Guarantees:
 * - INCR and PEXPIRE execute atomically in a single Redis evaluation.
 * - When key is created (hits == 1), PEXPIRE is set immediately within the same atomic script.
 *   This prevents key leak without TTL even if process crashes or disconnects.
 * - If key already exists without TTL (pttl < 0), PEXPIRE is assigned defensively.
 * - Returns [hits, pttl].
 */
const ATOMIC_RATE_LIMIT_INCREMENT_LUA = `
local key = KEYS[1]
local window_ms = tonumber(ARGV[1])

local hits = redis.call('INCR', key)
if hits == 1 then
  redis.call('PEXPIRE', key, window_ms)
end

local pttl = redis.call('PTTL', key)
if pttl < 0 then
  redis.call('PEXPIRE', key, window_ms)
  pttl = window_ms
end

return { hits, pttl }
`;

/**
 * Shared Redis Store for express-rate-limit
 *
 * Implements express-rate-limit Store interface using an atomic Lua script (INCR + PEXPIRE + PTTL).
 * Guarantees cross-instance quota sharing across multiple Express API replicas without TTL leaks.
 */
export class RedisRateLimitStore implements Store {
  private client: Redis;
  public prefix: string;
  public localKeys = false;
  private windowMs = 60_000;

  constructor(client: Redis, prefix = 'studyflow:rl:') {
    this.client = client;
    this.prefix = prefix;
  }

  init(options: { windowMs: number }): void {
    this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const fullKey = this.prefix + key;

    const result = (await this.client.eval(
      ATOMIC_RATE_LIMIT_INCREMENT_LUA,
      1,
      fullKey,
      String(this.windowMs)
    )) as [number | string, number | string];

    if (!result || result.length < 2) {
      throw new Error('Redis rate limit Lua script returned invalid result');
    }

    const hits = typeof result[0] === 'number' ? result[0] : Number(result[0]);
    const pttl = Math.max(0, typeof result[1] === 'number' ? result[1] : Number(result[1]));

    const resetTime = new Date(Date.now() + pttl);
    return {
      totalHits: hits,
      resetTime,
    };
  }

  async decrement(key: string): Promise<void> {
    const fullKey = this.prefix + key;
    await this.client.decr(fullKey);
  }

  async resetKey(key: string): Promise<void> {
    const fullKey = this.prefix + key;
    await this.client.del(fullKey);
  }
}

let sharedRedisRateLimitClient: Redis | null = null;

export function getRateLimitRedisClient(): Redis {
  if (!sharedRedisRateLimitClient) {
    sharedRedisRateLimitClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: false,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });
  }
  return sharedRedisRateLimitClient;
}

export async function closeRateLimitRedisClient(): Promise<void> {
  if (sharedRedisRateLimitClient) {
    try {
      await sharedRedisRateLimitClient.quit();
    } catch {
      sharedRedisRateLimitClient.disconnect();
    }
    sharedRedisRateLimitClient = null;
  }
}

/**
 * Creates a rate limit store based on environment configuration or custom options.
 */
export function createRateLimitStore(options?: {
  type?: 'redis' | 'memory';
  redisClient?: Redis;
  prefix?: string;
}): Store | undefined {
  const storeType = options?.type || env.RATE_LIMIT_STORE;
  if (storeType === 'redis') {
    const client = options?.redisClient || getRateLimitRedisClient();
    return new RedisRateLimitStore(client, options?.prefix || 'studyflow:rl:');
  }
  return undefined; // Falls back to default express-rate-limit MemoryStore
}

/**
 * Helper to normalize and hash an email or account identifier.
 * Uses SHA-256 so raw emails/passwords are NEVER written to Redis or logs.
 */
export function hashAccountIdentifier(email: unknown): string | null {
  if (typeof email !== 'string') return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
}

/**
 * Safe fail handler: When Redis / Store fails, reject with 503 rather than
 * quietly bypassing security limits (fail-closed security policy).
 */
export function handleRateLimiterError(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err) {
    res.status(503).json({
      error: {
        code: 'RATE_LIMITER_UNAVAILABLE',
        message: 'Layanan rate limiter sedang tidak tersedia. Permintaan ditolak demi keamanan.',
      },
    });
    return;
  }
  next();
}

/**
 * IP-based Auth Rate Limiter
 * Limits registration and generic auth attempts per client IP.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === 'test' ? 1000 : 30, // 30 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: false,
  store: createRateLimitStore(),
  keyGenerator: (req) => {
    // req.ip is extracted by Express based on 'trust proxy' configuration
    const rawIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    return ipKeyGenerator(rawIp);
  },
  handler: (_req, res, _next, options) => {
    res.status(429).json(options.message);
  },
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Terlalu banyak percobaan autentikasi dari alamat ini. Silakan tunggu beberapa saat.',
    },
  },
});

/**
 * Account-based Login Rate Limiter (Defense-in-depth against targeted credential stuffing)
 * Evaluates both client IP and targeted account hash to prevent single-account brute forcing.
 */
export const loginAccountRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === 'test' ? 1000 : 10, // 10 attempts per account per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: false,
  store: createRateLimitStore({ prefix: 'studyflow:rl:login:' }),
  keyGenerator: (req) => {
    const rawIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const accountHash = hashAccountIdentifier(req.body?.email);
    return accountHash ? `acct:${accountHash}` : `ip:${ipKeyGenerator(rawIp)}`;
  },
  handler: (_req, res, _next, options) => {
    res.status(429).json(options.message);
  },
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Terlalu banyak percobaan login untuk akun ini. Silakan tunggu beberapa saat.',
    },
  },
});

/**
 * IP-based Forgot Password Rate Limiter
 * Limits password reset requests per client IP.
 */
export const forgotPasswordIpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === 'test' ? 1000 : 10, // 10 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: false,
  store: createRateLimitStore({ prefix: 'studyflow:rl:forgot:ip:' }),
  keyGenerator: (req) => {
    const rawIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    return ipKeyGenerator(rawIp);
  },
  handler: (_req, res, _next, options) => {
    res.status(429).json(options.message);
  },
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Terlalu banyak permintaan reset kata sandi dari alamat ini. Silakan tunggu beberapa saat.',
    },
  },
});

/**
 * Account-based Forgot Password Rate Limiter
 * Limits password reset requests per hashed target email.
 * Guarantees raw emails are NEVER stored in Redis keys.
 */
export const forgotPasswordAccountRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === 'test' ? 1000 : 5, // 5 requests per account per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: false,
  store: createRateLimitStore({ prefix: 'studyflow:rl:forgot:acct:' }),
  keyGenerator: (req) => {
    const rawIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const accountHash = hashAccountIdentifier(req.body?.email);
    return accountHash ? `acct:${accountHash}` : `ip:${ipKeyGenerator(rawIp)}`;
  },
  handler: (_req, res, _next, options) => {
    res.status(429).json(options.message);
  },
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Terlalu banyak permintaan reset kata sandi untuk akun ini. Silakan tunggu beberapa saat.',
    },
  },
});

