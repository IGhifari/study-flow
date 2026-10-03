import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { QUEUE_NAMES, SmokeJobData, SmokeJobResult } from '@studyflow/shared';
import { env } from '../config/env.js';

export function createRedisConnection(): Redis {
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null, // Required by BullMQ
    lazyConnect: true,
  });
}

export async function processSmokeJob(job: Job<SmokeJobData, SmokeJobResult>): Promise<SmokeJobResult> {
  const start = Date.now();
  console.log(JSON.stringify({
    level: 'info',
    timestamp: new Date().toISOString(),
    message: `[Worker] Processing smoke job ${job.id}`,
    data: job.data,
  }));

  // Simulate minimal workload (e.g. 50ms)
  await new Promise((resolve) => setTimeout(resolve, 50));

  const result: SmokeJobResult = {
    jobId: job.data.jobId,
    processedAt: new Date().toISOString(),
    status: 'completed',
    durationMs: Date.now() - start,
  };

  console.log(JSON.stringify({
    level: 'info',
    timestamp: new Date().toISOString(),
    message: `[Worker] Smoke job ${job.id} completed successfully`,
    result,
  }));

  return result;
}

export function createSmokeQueue(connection: Redis): Queue<SmokeJobData, SmokeJobResult> {
  return new Queue<SmokeJobData, SmokeJobResult>(QUEUE_NAMES.smoke, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: {
        count: 50,
      },
      removeOnFail: {
        count: 100,
      },
    },
  });
}

export function createSmokeWorker(connection: Redis): Worker<SmokeJobData, SmokeJobResult> {
  const worker = new Worker<SmokeJobData, SmokeJobResult>(
    QUEUE_NAMES.smoke,
    processSmokeJob,
    {
      connection,
      concurrency: 2,
    }
  );

  worker.on('ready', () => {
    console.log(JSON.stringify({
      level: 'info',
      timestamp: new Date().toISOString(),
      message: `[Worker] Smoke worker is ready and listening to queue: ${QUEUE_NAMES.smoke}`,
    }));
  });

  worker.on('error', (err) => {
    console.error(JSON.stringify({
      level: 'error',
      timestamp: new Date().toISOString(),
      message: `[Worker] Smoke worker encountered an error`,
      error: err.message,
    }));
  });

  worker.on('failed', (job, err) => {
    console.error(JSON.stringify({
      level: 'error',
      timestamp: new Date().toISOString(),
      message: `[Worker] Smoke job ${job?.id} failed`,
      error: err.message,
    }));
  });

  return worker;
}
