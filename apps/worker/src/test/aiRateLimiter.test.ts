import { describe, it, expect, beforeEach } from 'vitest';
import { AiCallRateLimiter } from '../services/aiRateLimiter.js';
import { AiProviderError } from '../services/aiProvider.js';

describe('AiCallRateLimiter Unit Tests', () => {
  let limiter: AiCallRateLimiter;

  beforeEach(() => {
    limiter = new AiCallRateLimiter({
      callsPerMinute: 3,
      maxCallsPerJob: 4,
      redisClient: null, // in-memory mode for fast unit tests
    });
  });

  it('should allow calls within RPM and job call limits', async () => {
    const jobId = 'test-job-1';
    await expect(limiter.acquirePermit(jobId)).resolves.not.toThrow();
    await expect(limiter.acquirePermit(jobId)).resolves.not.toThrow();
    await expect(limiter.acquirePermit(jobId)).resolves.not.toThrow();
  });

  it('should reject call when per-job total call limit is exceeded', async () => {
    const jobId = 'test-job-exhaustion';

    // Max 4 calls allowed
    await limiter.acquirePermit(jobId);
    await limiter.acquirePermit(jobId);
    await limiter.acquirePermit(jobId);
    // 4th call
    limiter.clearRpmWindow(); // clear RPM window without wiping job call count
    await limiter.acquirePermit(jobId);

    // 5th call exceeds maxCallsPerJob (4)
    limiter.clearRpmWindow();
    let thrownError: any = null;
    try {
      await limiter.acquirePermit(jobId);
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeInstanceOf(AiProviderError);
    expect(thrownError.code).toBe('AI_JOB_CALL_LIMIT_EXCEEDED');
    expect(thrownError.isRetryable).toBe(false);
  });

  it('should track job call limits independently per job', async () => {
    const jobA = 'job-a';
    const jobB = 'job-b';

    await limiter.acquirePermit(jobA);
    await limiter.acquirePermit(jobB);

    limiter.clearRpmWindow(); // clear RPM window
    await limiter.acquirePermit(jobA);
    await limiter.acquirePermit(jobB);

    // Both should still have capacity
    limiter.clearRpmWindow();
    await expect(limiter.acquirePermit(jobA)).resolves.not.toThrow();
    await expect(limiter.acquirePermit(jobB)).resolves.not.toThrow();
  });

  it('should throw AI_RATE_LIMIT_EXCEEDED when calls per minute is exceeded', async () => {
    const strictLimiter = new AiCallRateLimiter({
      callsPerMinute: 2,
      maxCallsPerJob: 10,
      redisClient: null,
    });

    await strictLimiter.acquirePermit();
    await strictLimiter.acquirePermit();

    // 3rd call immediately exceeds 2 calls/min
    let thrown: any = null;
    try {
      await strictLimiter.acquirePermit();
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(AiProviderError);
    expect(thrown.code).toBe('AI_RATE_LIMIT_EXCEEDED');
    expect(thrown.isRetryable).toBe(true);
    expect(thrown.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('should reject provider calls when Redis is unavailable and in-memory is not allowed', async () => {
    const liveProductionLimiter = new AiCallRateLimiter({
      callsPerMinute: 15,
      maxCallsPerJob: 8,
      redisClient: null,
      allowInMemory: false, // simulate live environment without Redis or when disconnected
    });

    let thrown: any = null;
    try {
      await liveProductionLimiter.acquirePermit('job-live-redis-down');
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(AiProviderError);
    expect(thrown.code).toBe('AI_REDIS_UNAVAILABLE');
    expect(thrown.isRetryable).toBe(true);
    expect(thrown.retryAfterSeconds).toBe(15);
  });

  it('should resume permitting provider calls once Redis is restored', async () => {
    const liveProductionLimiter = new AiCallRateLimiter({
      callsPerMinute: 15,
      maxCallsPerJob: 8,
      redisClient: null,
      allowInMemory: false,
    });

    // 1. While Redis is down, calls fail with retryable error
    await expect(liveProductionLimiter.acquirePermit('job-recovery-1')).rejects.toThrowError(
      /Layanan antrean dan pembatas laju AI \(Redis\) sedang tidak tersedia/
    );

    // 2. Mock Redis client restored
    const mockRedis: any = {
      status: 'ready',
      eval: async () => ['ALLOWED', '1', '1'],
      incr: async () => 1,
      expire: async () => 1,
      pipeline: () => ({
        zremrangebyscore: () => {},
        zcard: () => {},
        zadd: () => {},
        expire: () => {},
        exec: async () => [[null, 0], [null, 0]],
      }),
      zrange: async () => [],
    };

    liveProductionLimiter.setRedisClient(mockRedis);

    // 3. Now permit succeeds without throwing
    await expect(liveProductionLimiter.acquirePermit('job-recovery-1')).resolves.not.toThrow();
  });
});
