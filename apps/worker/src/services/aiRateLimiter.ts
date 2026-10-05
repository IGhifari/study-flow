import type { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { AiProviderError } from './aiProvider.js';

export interface RateLimiterOptions {
  callsPerMinute?: number;
  maxCallsPerJob?: number;
  redisClient?: Redis | null;
  allowInMemory?: boolean; // Only for explicit unit testing
}

export class AiCallRateLimiter {
  private callsPerMinute: number;
  private maxCallsPerJob: number;
  private redis: Redis | null;
  private allowInMemory: boolean;
  // In-memory fallback ONLY for explicit test runners
  private memoryCalls: number[] = [];
  private memoryJobCalls: Map<string, number> = new Map();

  constructor(options?: RateLimiterOptions) {
    this.callsPerMinute = options?.callsPerMinute ?? env.AI_CALLS_PER_MINUTE ?? 15;
    this.maxCallsPerJob = options?.maxCallsPerJob ?? env.AI_MAX_CALLS_PER_JOB ?? 8;
    this.redis = options?.redisClient ?? null;
    this.allowInMemory = options?.allowInMemory ?? (env.NODE_ENV === 'test');
  }

  setRedisClient(redis: Redis | null) {
    this.redis = redis;
  }

  setAllowInMemory(allow: boolean) {
    this.allowInMemory = allow;
  }

  getCallsPerMinute(): number {
    return this.callsPerMinute;
  }

  getMaxCallsPerJob(): number {
    return this.maxCallsPerJob;
  }

  private isRedisUsable(): boolean {
    if (!this.redis) return false;
    // Check ioredis status if available
    const status = (this.redis as any).status;
    if (status && status !== 'ready' && status !== 'connect') {
      return false;
    }
    return true;
  }

  /**
   * Acquires a permit to execute a single AI provider call.
   * Throws AiProviderError if job total call limit is exceeded or if RPM limit cannot be satisfied.
   * If Redis is unavailable and in-memory is not explicitly allowed, throws a retryable error.
   */
  async acquirePermit(jobId?: string): Promise<void> {
    const isRedisReady = this.isRedisUsable();

    if (!isRedisReady && !this.allowInMemory) {
      throw new AiProviderError(
        'AI_REDIS_UNAVAILABLE',
        'Layanan antrean dan pembatas laju AI (Redis) sedang tidak tersedia. Permintaan akan dicoba kembali secara otomatis.',
        true, // isRetryable: allows BullMQ to delay/retry without failing permanently
        15,
        503
      );
    }

    const now = Date.now();

    // 1. Enforce per-job total calls limit (including retries across the job lifecycle)
    if (jobId) {
      await this.enforceJobCallLimit(jobId, isRedisReady);
    }

    // 2. Enforce distributed calls-per-minute (RPM) limit
    await this.enforceRpmLimit(now, isRedisReady);
  }

  private async enforceJobCallLimit(jobId: string, isRedisReady: boolean): Promise<void> {
    if (isRedisReady && this.redis) {
      try {
        const key = `studyflow:ai:job_calls:${jobId}`;
        const count = await this.redis.incr(key);
        if (count === 1) {
          await this.redis.expire(key, 86400); // 24-hour TTL across worker restarts and retries
        }
        if (count > this.maxCallsPerJob) {
          throw new AiProviderError(
            'AI_JOB_CALL_LIMIT_EXCEEDED',
            `Batas maksimum panggilan AI untuk pekerjaan ini telah tercapai (${this.maxCallsPerJob} panggilan termasuk retry).`,
            false,
            undefined,
            429
          );
        }
      } catch (err) {
        if (err instanceof AiProviderError) throw err;
        // Redis connection error during operation
        if (!this.allowInMemory) {
          throw new AiProviderError(
            'AI_REDIS_UNAVAILABLE',
            'Koneksi Redis terputus saat memeriksa batas panggilan AI. Permintaan akan dicoba kembali.',
            true,
            15,
            503
          );
        }
        this.trackMemoryJobCall(jobId);
      }
    } else if (this.allowInMemory) {
      this.trackMemoryJobCall(jobId);
    }
  }

  private trackMemoryJobCall(jobId: string) {
    const current = (this.memoryJobCalls.get(jobId) ?? 0) + 1;
    this.memoryJobCalls.set(jobId, current);
    if (current > this.maxCallsPerJob) {
      throw new AiProviderError(
        'AI_JOB_CALL_LIMIT_EXCEEDED',
        `Batas maksimum panggilan AI untuk pekerjaan ini telah tercapai (${this.maxCallsPerJob} panggilan termasuk retry).`,
        false,
        undefined,
        429
      );
    }
  }

  private async enforceRpmLimit(now: number, isRedisReady: boolean): Promise<void> {
    const windowMs = 60000;
    const windowStart = now - windowMs;

    if (isRedisReady && this.redis) {
      try {
        const key = 'studyflow:ai:ratelimit:calls';
        // Atomic pipeline: clear expired entries, count current in window
        const pipeline = this.redis.pipeline();
        pipeline.zremrangebyscore(key, 0, windowStart);
        pipeline.zcard(key);
        const results = await pipeline.exec();

        const currentCount = (results?.[1]?.[1] as number) || 0;

        if (currentCount >= this.callsPerMinute) {
          // Calculate wait time based on oldest call in current window
          const oldestCalls = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
          const oldestScore = oldestCalls.length >= 2 ? parseInt(oldestCalls[1] || '0', 10) : windowStart;
          const waitMs = Math.max(100, oldestScore + windowMs - now + 50);

          if (waitMs <= 4000) {
            // Short pacing delay: wait and retry
            await new Promise((r) => setTimeout(r, waitMs));
            return this.enforceRpmLimit(Date.now(), isRedisReady);
          }

          throw new AiProviderError(
            'AI_RATE_LIMIT_EXCEEDED',
            `Batas frekuensi panggilan AI (${this.callsPerMinute} panggilan/menit) tercapai. Silakan coba kembali dalam ${Math.ceil(waitMs / 1000)} detik.`,
            true,
            Math.ceil(waitMs / 1000),
            429
          );
        }

        // Add this call to the sliding window
        const member = `${now}:${Math.random().toString(36).slice(2, 8)}`;
        const addPipeline = this.redis.pipeline();
        addPipeline.zadd(key, now, member);
        addPipeline.expire(key, 120);
        await addPipeline.exec();
      } catch (err) {
        if (err instanceof AiProviderError) throw err;
        if (!this.allowInMemory) {
          throw new AiProviderError(
            'AI_REDIS_UNAVAILABLE',
            'Koneksi Redis terputus saat memeriksa batas frekuensi panggilan AI. Permintaan akan dicoba kembali.',
            true,
            15,
            503
          );
        }
        this.trackMemoryRpm(now, windowStart, windowMs);
      }
    } else if (this.allowInMemory) {
      this.trackMemoryRpm(now, windowStart, windowMs);
    }
  }

  private trackMemoryRpm(now: number, windowStart: number, windowMs: number) {
    this.memoryCalls = this.memoryCalls.filter((t) => t > windowStart);
    if (this.memoryCalls.length >= this.callsPerMinute) {
      const oldest = this.memoryCalls[0] ?? windowStart;
      const waitMs = Math.max(100, oldest + windowMs - now + 50);
      if (waitMs <= 4000) {
        // synchronously wait if short
        return;
      }
      throw new AiProviderError(
        'AI_RATE_LIMIT_EXCEEDED',
        `Batas frekuensi panggilan AI (${this.callsPerMinute} panggilan/menit) tercapai. Silakan coba kembali dalam ${Math.ceil(waitMs / 1000)} detik.`,
        true,
        Math.ceil(waitMs / 1000),
        429
      );
    }
    this.memoryCalls.push(now);
  }

  clearRpmWindow() {
    this.memoryCalls = [];
  }

  resetMemory() {
    this.memoryCalls = [];
    this.memoryJobCalls.clear();
  }
}

export const globalAiRateLimiter = new AiCallRateLimiter();
