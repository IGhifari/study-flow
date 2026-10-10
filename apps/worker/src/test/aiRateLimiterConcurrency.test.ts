import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import Redis from 'ioredis';
import { AiCallRateLimiter } from '../services/aiRateLimiter.js';
import { AiProviderError, MockAiProviderAdapter } from '../services/aiProvider.js';

describe('AiCallRateLimiter Real Redis Concurrency & Atomicity Tests', () => {
  let redis: Redis;
  let testPrefix: string;

  beforeAll(async () => {
    redis = new Redis('redis://localhost:6379');
    await redis.ping();
  });

  afterAll(async () => {
    await redis.quit();
  });

  beforeEach(() => {
    testPrefix = `test:studyflow:ai:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  });

  afterEach(async () => {
    // Clean up ONLY keys belonging to this test prefix without touching any shared Redis keys
    const keys = await redis.keys(`${testPrefix}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    vi.restoreAllMocks();
  });

  it('1. Banyak permintaan izin bersamaan dari beberapa instance limiter tidak melebihi batas RPM', async () => {
    const callsPerMinute = 5;
    const windowMs = 5000;

    // Create 3 independent limiter instances simulating 3 worker processes sharing the same Redis namespace
    const limiter1 = new AiCallRateLimiter({
      callsPerMinute,
      windowMs,
      keyPrefix: testPrefix,
      redisClient: redis,
      allowInMemory: false,
    });
    const limiter2 = new AiCallRateLimiter({
      callsPerMinute,
      windowMs,
      keyPrefix: testPrefix,
      redisClient: redis,
      allowInMemory: false,
    });
    const limiter3 = new AiCallRateLimiter({
      callsPerMinute,
      windowMs,
      keyPrefix: testPrefix,
      redisClient: redis,
      allowInMemory: false,
    });

    const limiters = [limiter1, limiter2, limiter3];

    // Fire 15 concurrent requests across the 3 limiter instances for different jobs
    const concurrentRequests = Array.from({ length: 15 }, (_, i) => {
      const limiter = limiters[i % limiters.length]!;
      return limiter.acquirePermit(`job-concurrent-${i}`);
    });

    const results = await Promise.allSettled(concurrentRequests);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactly 5 requests must be granted, and exactly 10 rejected due to RPM saturation
    expect(fulfilled).toHaveLength(callsPerMinute);
    expect(rejected).toHaveLength(10);

    for (const r of rejected) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(AiProviderError);
      expect((r as PromiseRejectedResult).reason.code).toBe('AI_RATE_LIMIT_EXCEEDED');
      expect((r as PromiseRejectedResult).reason.isRetryable).toBe(true);
      expect((r as PromiseRejectedResult).reason.retryAfterSeconds).toBeGreaterThan(0);
    }

    // Verify in Redis: RPM sorted set has exactly 5 members
    const rpmCount = await limiter1.getRpmCallCount();
    expect(rpmCount).toBe(callsPerMinute);
  });

  it('2. Permintaan bersamaan untuk job yang sama tidak melampaui batas per-job', async () => {
    const maxCallsPerJob = 3;
    const callsPerMinute = 20;
    const targetJobId = 'job-heavy-concurrency';

    const limiter = new AiCallRateLimiter({
      callsPerMinute,
      maxCallsPerJob,
      keyPrefix: testPrefix,
      redisClient: redis,
      allowInMemory: false,
    });

    // Fire 10 concurrent requests for the exact same job ID
    const requests = Array.from({ length: 10 }, () => limiter.acquirePermit(targetJobId));
    const results = await Promise.allSettled(requests);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactly maxCallsPerJob (3) must succeed, and 7 must fail
    expect(fulfilled).toHaveLength(maxCallsPerJob);
    expect(rejected).toHaveLength(7);

    for (const r of rejected) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(AiProviderError);
      expect((r as PromiseRejectedResult).reason.code).toBe('AI_JOB_CALL_LIMIT_EXCEEDED');
      expect((r as PromiseRejectedResult).reason.isRetryable).toBe(false);
    }

    // Verify counter in Redis: exactly 3
    const recordedCount = await limiter.getJobCallCount(targetJobId);
    expect(recordedCount).toBe(maxCallsPerJob);
  });

  it('3. Penolakan RPM tidak menaikkan counter per-job', async () => {
    const callsPerMinute = 2;
    const windowMs = 5000;
    const targetJobId = 'job-rpm-rejection-victim';

    const limiter = new AiCallRateLimiter({
      callsPerMinute,
      windowMs,
      maxCallsPerJob: 5,
      keyPrefix: testPrefix,
      redisClient: redis,
      allowInMemory: false,
    });

    // Saturate RPM with other jobs
    await limiter.acquirePermit('job-filler-1');
    await limiter.acquirePermit('job-filler-2');

    // Now attempt permit for target job (must be rejected by RPM)
    await expect(limiter.acquirePermit(targetJobId)).rejects.toMatchObject({
      code: 'AI_RATE_LIMIT_EXCEEDED',
      isRetryable: true,
    });

    // Crucial check: target job counter must NOT have been incremented!
    const targetCount = await limiter.getJobCallCount(targetJobId);
    expect(targetCount).toBe(0);
  });

  it('4. Penolakan batas per-job tidak mengonsumsi slot RPM', async () => {
    const maxCallsPerJob = 2;
    const callsPerMinute = 5;
    const exhaustedJobId = 'job-exhausted-target';
    const freshJobId = 'job-fresh-target';

    const limiter = new AiCallRateLimiter({
      callsPerMinute,
      maxCallsPerJob,
      keyPrefix: testPrefix,
      redisClient: redis,
      allowInMemory: false,
    });

    // Consume 2 calls for exhaustedJobId (both succeed)
    await limiter.acquirePermit(exhaustedJobId);
    await limiter.acquirePermit(exhaustedJobId);
    expect(await limiter.getRpmCallCount()).toBe(2);

    // 3rd call for exhaustedJobId is rejected by job limit
    await expect(limiter.acquirePermit(exhaustedJobId)).rejects.toMatchObject({
      code: 'AI_JOB_CALL_LIMIT_EXCEEDED',
      isRetryable: false,
    });

    // Crucial check: RPM count is still 2, the rejected call did NOT consume an RPM slot
    expect(await limiter.getRpmCallCount()).toBe(2);

    // Another job can still acquire permits because RPM has 3 available slots remaining
    await expect(limiter.acquirePermit(freshJobId)).resolves.not.toThrow();
    expect(await limiter.getRpmCallCount()).toBe(3);
  });

  it('5. Instance limiter baru membaca counter job yang sudah ada (persistensi lintas restart/worker)', async () => {
    const jobId = 'job-persisted-worker-restart';

    const limiter1 = new AiCallRateLimiter({
      callsPerMinute: 10,
      maxCallsPerJob: 3,
      keyPrefix: testPrefix,
      redisClient: redis,
      allowInMemory: false,
    });

    // Worker 1 executes 2 calls for this job
    await limiter1.acquirePermit(jobId);
    await limiter1.acquirePermit(jobId);
    expect(await limiter1.getJobCallCount(jobId)).toBe(2);

    // Worker 1 stops, Worker 2 (new instance) starts up
    const limiter2 = new AiCallRateLimiter({
      callsPerMinute: 10,
      maxCallsPerJob: 3,
      keyPrefix: testPrefix,
      redisClient: redis,
      allowInMemory: false,
    });

    // Worker 2 reads existing counter directly from Redis
    expect(await limiter2.getJobCallCount(jobId)).toBe(2);

    // Worker 2 executes 3rd call (succeeds)
    await expect(limiter2.acquirePermit(jobId)).resolves.not.toThrow();
    expect(await limiter2.getJobCallCount(jobId)).toBe(3);

    // 4th call is rejected on Worker 2
    await expect(limiter2.acquirePermit(jobId)).rejects.toMatchObject({
      code: 'AI_JOB_CALL_LIMIT_EXCEEDED',
    });
  });

  it('6. Redis tidak tersedia -> provider tidak dipanggil', async () => {
    const brokenLimiter = new AiCallRateLimiter({
      callsPerMinute: 10,
      maxCallsPerJob: 5,
      keyPrefix: testPrefix,
      redisClient: null,
      allowInMemory: false, // Disallow in-memory fallback
    });

    const mockProvider = new MockAiProviderAdapter();
    const providerHandler = vi.fn().mockResolvedValue({
      title: 'Success',
      overview: 'Summary',
      keyConcepts: [],
      sections: [],
      keyTerms: [],
      durationMs: 50,
    });
    mockProvider.setCustomHandler(providerHandler);

    // Simulate provider execution protected by broken limiter
    let errorCaught: any = null;
    try {
      await brokenLimiter.acquirePermit('job-unreachable');
      await mockProvider.generateSummary({
        materialTitle: 'Test Material',
        totalPages: 1,
        pages: [{ pageNumber: 1, text: 'Sample text' }],
      });
    } catch (err) {
      errorCaught = err;
    }

    expect(errorCaught).toBeInstanceOf(AiProviderError);
    expect(errorCaught.code).toBe('AI_REDIS_UNAVAILABLE');
    expect(errorCaught.isRetryable).toBe(true);
    // Provider handler was NEVER invoked
    expect(providerHandler).not.toHaveBeenCalled();
  });

  it('7. Redis pulih -> pemberian izin berjalan kembali', async () => {
    const recoveryLimiter = new AiCallRateLimiter({
      callsPerMinute: 10,
      maxCallsPerJob: 5,
      keyPrefix: testPrefix,
      redisClient: null,
      allowInMemory: false,
    });

    // While Redis is null/disconnected: fails
    await expect(recoveryLimiter.acquirePermit('job-recover')).rejects.toMatchObject({
      code: 'AI_REDIS_UNAVAILABLE',
    });

    // Redis connection restored
    recoveryLimiter.setRedisClient(redis);

    // Now permit succeeds
    await expect(recoveryLimiter.acquirePermit('job-recover')).resolves.not.toThrow();
    expect(await recoveryLimiter.getJobCallCount('job-recover')).toBe(1);
  });

  it('8. Jendela RPM berakhir -> izin tersedia lagi (sliding window expiration)', async () => {
    const windowMs = 400; // 400ms controlled test window
    const callsPerMinute = 2;

    const fastLimiter = new AiCallRateLimiter({
      callsPerMinute,
      windowMs,
      keyPrefix: testPrefix,
      redisClient: redis,
      allowInMemory: false,
      maxPacingDelayMs: 0, // Disable in-process sleep to immediately assert 429 rejection
    });

    // Consume 2 calls to saturate the window
    await fastLimiter.acquirePermit('job-win-1');
    await fastLimiter.acquirePermit('job-win-2');

    // 3rd call immediately fails with rate limit exceeded
    await expect(fastLimiter.acquirePermit('job-win-3')).rejects.toMatchObject({
      code: 'AI_RATE_LIMIT_EXCEEDED',
      isRetryable: true,
    });

    // Wait for the sliding window to elapse (450ms > 400ms)
    await new Promise((r) => setTimeout(r, 450));

    // Permit is available again without errors
    await expect(fastLimiter.acquirePermit('job-win-3')).resolves.not.toThrow();
    expect(await fastLimiter.getRpmCallCount()).toBe(1);
  });

  it('9. Retry panggilan provider dihitung sekali per izin, tanpa double-count', async () => {
    const jobId = 'job-retry-counting-test';
    const limiter = new AiCallRateLimiter({
      callsPerMinute: 10,
      maxCallsPerJob: 5,
      keyPrefix: testPrefix,
      redisClient: redis,
      allowInMemory: false,
    });

    let invocationCount = 0;
    const executeProviderWithLimiter = async () => {
      await limiter.acquirePermit(jobId);
      invocationCount++;
      if (invocationCount === 1) {
        // Attempt 1 fails with retryable error
        throw new AiProviderError('AI_TIMEOUT', 'Timeout during call', true);
      }
      return { success: true };
    };

    // Attempt 1 (fails after acquiring permit)
    await expect(executeProviderWithLimiter()).rejects.toMatchObject({
      code: 'AI_TIMEOUT',
    });
    expect(invocationCount).toBe(1);
    expect(await limiter.getJobCallCount(jobId)).toBe(1);
    expect(await limiter.getRpmCallCount()).toBe(1);

    // Attempt 2 (retried job)
    const result = await executeProviderWithLimiter();
    expect(result.success).toBe(true);
    expect(invocationCount).toBe(2);

    // Verify exactly 2 calls recorded in Redis for this job and 2 in RPM window
    expect(await limiter.getJobCallCount(jobId)).toBe(2);
    expect(await limiter.getRpmCallCount()).toBe(2);
  });

  it('10. Pacing delay singkat menunggu secara otomatis dan berhasil ketika waktu tunggu <= maxPacingDelayMs', async () => {
    const windowMs = 300; // 300ms window
    const callsPerMinute = 2;

    const pacingLimiter = new AiCallRateLimiter({
      callsPerMinute,
      windowMs,
      keyPrefix: testPrefix,
      redisClient: redis,
      allowInMemory: false,
      maxPacingDelayMs: 2000, // Enable in-process pacing up to 2 seconds
    });

    // Consume 2 calls to saturate the window
    await pacingLimiter.acquirePermit('job-pacing-1');
    await pacingLimiter.acquirePermit('job-pacing-2');

    // 3rd call will calculate waitMs around ~300ms (<= 2000ms), wait in-process, and succeed!
    const startTime = Date.now();
    await expect(pacingLimiter.acquirePermit('job-pacing-3')).resolves.not.toThrow();
    const elapsed = Date.now() - startTime;

    // Must have waited at least ~250ms for the oldest call to drop out of the window
    expect(elapsed).toBeGreaterThanOrEqual(200);
  });
});
