import { describe, it, expect } from 'vitest';
import { processSmokeJob } from '../queues/smokeQueue.js';
import { SmokeJobData, SmokeJobResultSchema } from '@studyflow/shared';
import { Job } from 'bullmq';

describe('Worker Smoke Job Handler', () => {
  it('should process smoke job payload and return valid SmokeJobResult', async () => {
    const mockData: SmokeJobData = {
      jobId: 'test-smoke-123',
      message: 'Unit test verification',
      enqueuedAt: new Date().toISOString(),
    };

    const mockJob = {
      id: 'job-1',
      data: mockData,
    } as unknown as Job<SmokeJobData>;

    const result = await processSmokeJob(mockJob);

    expect(result.jobId).toBe(mockData.jobId);
    expect(result.status).toBe('completed');
    expect(result.durationMs).toBeGreaterThanOrEqual(40);

    const parseResult = SmokeJobResultSchema.safeParse(result);
    expect(parseResult.success).toBe(true);
  });
});
