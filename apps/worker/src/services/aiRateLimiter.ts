import type { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { AiProviderError } from './aiProvider.js';

export interface RateLimiterOptions {
  callsPerMinute?: number;
  maxCallsPerJob?: number;
  redisClient?: Redis | null;
  allowInMemory?: boolean; // Only for explicit unit testing
  windowMs?: number; // Sliding window duration in ms (default: 60,000)
  keyPrefix?: string; // Redis namespace prefix (default: 'studyflow:ai')
  jobTtlSeconds?: number; // Retention period for per-job call counters (default: 86,400)
  maxPacingDelayMs?: number; // Max wait for in-process pacing retry (default: 4000, 0 to disable)
}

/**
 * Atomic Lua script for evaluating and reserving AI call permits in Redis.
 *
 * KEYS[1]: rpm_key - Sorted Set tracking timestamps of granted permits within sliding window
 * KEYS[2]: job_key - String counter tracking total provider calls made for a specific job
 *
 * ARGV[1]: now - Current timestamp in milliseconds
 * ARGV[2]: window_ms - Sliding window duration in milliseconds (typically 60000)
 * ARGV[3]: calls_per_minute - Maximum permitted calls within window_ms
 * ARGV[4]: max_calls_per_job - Maximum permitted lifetime calls for the job
 * ARGV[5]: has_job - 1 if job_key should be checked and incremented, 0 otherwise
 * ARGV[6]: member - Unique identifier for this call entry (e.g. now:random)
 * ARGV[7]: job_ttl - Expiration in seconds for the job counter key (typically 86400)
 * ARGV[8]: rpm_ttl - Expiration in seconds for the sliding window ZSET
 *
 * Guarantees:
 * - If rejected by job limit: job counter is NOT incremented, and RPM slot is NOT consumed.
 * - If rejected by RPM limit: job counter is NOT incremented, and RPM slot is NOT consumed.
 * - If granted: job counter is incremented by 1 (with TTL) and member is added to RPM window atomicity.
 */
const ATOMIC_ACQUIRE_PERMIT_LUA = `
local rpm_key = KEYS[1]
local job_key = KEYS[2]

local now = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local calls_per_minute = tonumber(ARGV[3])
local max_calls_per_job = tonumber(ARGV[4])
local has_job = tonumber(ARGV[5])
local member = ARGV[6]
local job_ttl = tonumber(ARGV[7])
local rpm_ttl = tonumber(ARGV[8])

-- 1. Enforce per-job limit before RPM check (atomic peek)
if has_job == 1 then
  local job_calls = tonumber(redis.call('GET', job_key) or '0')
  if job_calls >= max_calls_per_job then
    return {'REJECT_JOB_LIMIT', tostring(job_calls)}
  end
end

-- 2. Enforce sliding window RPM limit
local window_start = now - window_ms
redis.call('ZREMRANGEBYSCORE', rpm_key, 0, window_start)
local current_rpm = tonumber(redis.call('ZCARD', rpm_key))

if current_rpm >= calls_per_minute then
  local oldest = redis.call('ZRANGE', rpm_key, 0, 0, 'WITHSCORES')
  local oldest_score = window_start
  if oldest and #oldest >= 2 then
    oldest_score = tonumber(oldest[2]) or window_start
  end
  local wait_ms = oldest_score + window_ms - now + 50
  if wait_ms < 100 then
    wait_ms = 100
  end
  return {'REJECT_RPM_LIMIT', tostring(wait_ms), tostring(current_rpm)}
end

-- 3. Both limits satisfied: atomically commit job increment and RPM entry
local new_job_calls = 0
if has_job == 1 then
  new_job_calls = redis.call('INCR', job_key)
  local ttl = redis.call('TTL', job_key)
  if ttl < 0 then
    redis.call('EXPIRE', job_key, job_ttl)
  end
end

redis.call('ZADD', rpm_key, now, member)
redis.call('EXPIRE', rpm_key, rpm_ttl)

return {'ALLOWED', tostring(new_job_calls), tostring(current_rpm + 1)}
`;

export class AiCallRateLimiter {
  private callsPerMinute: number;
  private maxCallsPerJob: number;
  private windowMs: number;
  private keyPrefix: string;
  private jobTtlSeconds: number;
  private maxPacingDelayMs: number;
  private redis: Redis | null;
  private allowInMemory: boolean;

  // In-memory fallback ONLY for explicit unit test runners
  private memoryCalls: number[] = [];
  private memoryJobCalls: Map<string, number> = new Map();

  constructor(options?: RateLimiterOptions) {
    this.callsPerMinute = options?.callsPerMinute ?? env.AI_CALLS_PER_MINUTE ?? 15;
    this.maxCallsPerJob = options?.maxCallsPerJob ?? env.AI_MAX_CALLS_PER_JOB ?? 8;
    this.windowMs = options?.windowMs ?? 60000;
    this.keyPrefix = options?.keyPrefix ?? 'studyflow:ai';
    this.jobTtlSeconds = options?.jobTtlSeconds ?? 86400;
    this.maxPacingDelayMs = options?.maxPacingDelayMs ?? 4000;
    this.redis = options?.redisClient ?? null;
    this.allowInMemory = options?.allowInMemory ?? (this.redis === null && env.NODE_ENV === 'test');
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

  getWindowMs(): number {
    return this.windowMs;
  }

  getKeyPrefix(): string {
    return this.keyPrefix;
  }

  private isRedisUsable(): boolean {
    if (!this.redis) return false;
    const status = (this.redis as any).status;
    if (status && status !== 'ready' && status !== 'connect') {
      return false;
    }
    return true;
  }

  /**
   * Acquires a permit to execute a single AI provider call.
   * Atomically checks both the per-job limit and RPM sliding window limit in Redis.
   *
   * Note on Worker Crash Behavior:
   * Permit reservation in Redis occurs atomically before the provider call is dispatched.
   * If a worker process crashes, disconnects, or is terminated while the AI call is in-flight,
   * the permit remains consumed in Redis. This conservative counting strategy ensures that
   * the upstream provider RPM quota and the job's total invocation safety ceiling are never
   * exceeded across distributed nodes even during worker failure or restart scenarios.
   *
   * Throws:
   * - AiProviderError (AI_REDIS_UNAVAILABLE, 503, retryable) if Redis is down and in-memory is not explicitly permitted.
   * - AiProviderError (AI_JOB_CALL_LIMIT_EXCEEDED, 429, non-retryable) if per-job call limit is reached.
   * - AiProviderError (AI_RATE_LIMIT_EXCEEDED, 429, retryable) if RPM limit is saturated.
   */
  async acquirePermit(jobId?: string, totalPacedMs = 0): Promise<void> {
    const now = Date.now();

    if (this.redis) {
      if (!this.isRedisUsable()) {
        throw new AiProviderError(
          'AI_REDIS_UNAVAILABLE',
          'Layanan antrean dan pembatas laju AI (Redis) sedang tidak tersedia. Permintaan akan dicoba kembali secara otomatis.',
          true,
          15,
          503
        );
      }

      try {
        await this.acquirePermitRedis(now, jobId, totalPacedMs);
        return;
      } catch (err) {
        if (err instanceof AiProviderError) throw err;
        throw new AiProviderError(
          'AI_REDIS_UNAVAILABLE',
          `Koneksi Redis terputus saat memeriksa batas laju AI: ${err instanceof Error ? err.message : String(err)}`,
          true,
          15,
          503
        );
      }
    }

    if (!this.allowInMemory) {
      throw new AiProviderError(
        'AI_REDIS_UNAVAILABLE',
        'Layanan antrean dan pembatas laju AI (Redis) sedang tidak tersedia. Permintaan akan dicoba kembali secara otomatis.',
        true,
        15,
        503
      );
    }

    await this.acquirePermitInMemory(now, jobId, totalPacedMs);
  }

  private async acquirePermitRedis(
    now: number,
    jobId?: string,
    totalPacedMs = 0
  ): Promise<void> {
    if (!this.redis) return;

    const rpmKey = `${this.keyPrefix}:ratelimit:calls`;
    const jobKey = jobId ? `${this.keyPrefix}:job_calls:${jobId}` : `${this.keyPrefix}:no_job`;
    const hasJob = jobId ? 1 : 0;
    const member = `${now}:${Math.random().toString(36).slice(2, 10)}`;
    const rpmTtl = Math.max(120, Math.ceil((this.windowMs * 2) / 1000));

    // Handle mocks or clients that support eval
    let result: [string, string, string?];
    if (typeof (this.redis as any).eval === 'function') {
      result = (await (this.redis as any).eval(
        ATOMIC_ACQUIRE_PERMIT_LUA,
        2,
        rpmKey,
        jobKey,
        String(now),
        String(this.windowMs),
        String(this.callsPerMinute),
        String(this.maxCallsPerJob),
        String(hasJob),
        member,
        String(this.jobTtlSeconds),
        String(rpmTtl)
      )) as [string, string, string?];
    } else {
      throw new Error('Redis client does not support eval');
    }

    const action = result[0];

    if (action === 'REJECT_JOB_LIMIT') {
      throw new AiProviderError(
        'AI_JOB_CALL_LIMIT_EXCEEDED',
        `Batas maksimum panggilan AI untuk pekerjaan ini telah tercapai (${this.maxCallsPerJob} panggilan termasuk retry).`,
        false,
        undefined,
        429
      );
    }

    if (action === 'REJECT_RPM_LIMIT') {
      const waitMs = parseInt(result[1] || '100', 10);
      if (
        this.maxPacingDelayMs > 0 &&
        waitMs <= this.maxPacingDelayMs &&
        totalPacedMs + waitMs <= this.maxPacingDelayMs
      ) {
        await new Promise((r) => setTimeout(r, waitMs));
        return this.acquirePermitRedis(Date.now(), jobId, totalPacedMs + waitMs);
      }

      throw new AiProviderError(
        'AI_RATE_LIMIT_EXCEEDED',
        `Batas frekuensi panggilan AI (${this.callsPerMinute} panggilan/menit) tercapai. Silakan coba kembali dalam ${Math.ceil(waitMs / 1000)} detik.`,
        true,
        Math.ceil(waitMs / 1000),
        429
      );
    }

    // action === 'ALLOWED': successfully reserved permit atomicity
  }

  private async acquirePermitInMemory(
    now: number,
    jobId?: string,
    totalPacedMs = 0
  ): Promise<void> {
    const windowStart = now - this.windowMs;

    // 1. Enforce per-job limit
    if (jobId) {
      const currentJobCalls = this.memoryJobCalls.get(jobId) ?? 0;
      if (currentJobCalls >= this.maxCallsPerJob) {
        throw new AiProviderError(
          'AI_JOB_CALL_LIMIT_EXCEEDED',
          `Batas maksimum panggilan AI untuk pekerjaan ini telah tercapai (${this.maxCallsPerJob} panggilan termasuk retry).`,
          false,
          undefined,
          429
        );
      }
    }

    // 2. Enforce sliding window RPM limit
    this.memoryCalls = this.memoryCalls.filter((t) => t > windowStart);
    if (this.memoryCalls.length >= this.callsPerMinute) {
      const oldest = this.memoryCalls[0] ?? windowStart;
      const waitMs = Math.max(100, oldest + this.windowMs - now + 50);

      if (
        this.maxPacingDelayMs > 0 &&
        waitMs <= this.maxPacingDelayMs &&
        totalPacedMs + waitMs <= this.maxPacingDelayMs
      ) {
        await new Promise((r) => setTimeout(r, waitMs));
        return this.acquirePermitInMemory(Date.now(), jobId, totalPacedMs + waitMs);
      }

      throw new AiProviderError(
        'AI_RATE_LIMIT_EXCEEDED',
        `Batas frekuensi panggilan AI (${this.callsPerMinute} panggilan/menit) tercapai. Silakan coba kembali dalam ${Math.ceil(waitMs / 1000)} detik.`,
        true,
        Math.ceil(waitMs / 1000),
        429
      );
    }

    // 3. Both passed! Atomically commit to memory
    if (jobId) {
      this.memoryJobCalls.set(jobId, (this.memoryJobCalls.get(jobId) ?? 0) + 1);
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

  async clearRedisRpmWindow(): Promise<void> {
    if (this.redis) {
      const rpmKey = `${this.keyPrefix}:ratelimit:calls`;
      await this.redis.del(rpmKey);
    }
  }

  async clearRedisJobCalls(jobId: string): Promise<void> {
    if (this.redis) {
      const jobKey = `${this.keyPrefix}:job_calls:${jobId}`;
      await this.redis.del(jobKey);
    }
  }

  async getJobCallCount(jobId: string): Promise<number> {
    if (this.redis) {
      const jobKey = `${this.keyPrefix}:job_calls:${jobId}`;
      const val = await this.redis.get(jobKey);
      return val ? parseInt(val, 10) : 0;
    }
    return this.memoryJobCalls.get(jobId) ?? 0;
  }

  async getRpmCallCount(): Promise<number> {
    if (this.redis) {
      const rpmKey = `${this.keyPrefix}:ratelimit:calls`;
      const windowStart = Date.now() - this.windowMs;
      await this.redis.zremrangebyscore(rpmKey, 0, windowStart);
      return await this.redis.zcard(rpmKey);
    }
    const windowStart = Date.now() - this.windowMs;
    return this.memoryCalls.filter((t) => t > windowStart).length;
  }
}

export const globalAiRateLimiter = new AiCallRateLimiter();
