import { QueueEvents } from 'bullmq';
import { QUEUE_NAMES, SmokeJobData, SmokeJobDataSchema, SmokeJobResultSchema } from '@studyflow/shared';
import { createRedisConnection, createSmokeQueue } from '../queues/smokeQueue.js';
import crypto from 'node:crypto';

async function runSmokeEnqueue(): Promise<void> {
  console.log(JSON.stringify({
    level: 'info',
    timestamp: new Date().toISOString(),
    message: 'Initiating worker smoke test enqueue...',
  }));

  const redis = createRedisConnection();
  const queue = createSmokeQueue(redis);
  const queueEvents = new QueueEvents(QUEUE_NAMES.smoke, {
    connection: createRedisConnection(),
  });

  const jobId = crypto.randomUUID();
  const jobPayload: SmokeJobData = {
    jobId,
    message: 'Milestone 1 foundation worker smoke test',
    enqueuedAt: new Date().toISOString(),
  };

  // Validate payload before enqueue
  SmokeJobDataSchema.parse(jobPayload);

  console.log(JSON.stringify({
    level: 'info',
    timestamp: new Date().toISOString(),
    message: `Enqueueing smoke job ${jobId}...`,
  }));

  const job = await queue.add('smoke-test', jobPayload, {
    jobId,
  });

  console.log(JSON.stringify({
    level: 'info',
    timestamp: new Date().toISOString(),
    message: `Job ${job.id} enqueued successfully. Waiting up to 10 seconds for worker to process...`,
  }));

  try {
    const rawResult = await job.waitUntilFinished(queueEvents, 10000);
    const parsedResult = SmokeJobResultSchema.parse(rawResult);

    console.log(JSON.stringify({
      level: 'info',
      timestamp: new Date().toISOString(),
      message: 'Smoke job processed successfully by worker!',
      result: parsedResult,
    }));
  } catch (err) {
    console.error(JSON.stringify({
      level: 'error',
      timestamp: new Date().toISOString(),
      message: 'Smoke job failed or timed out. Make sure the worker process is running and connected to Redis.',
      error: err instanceof Error ? err.message : String(err),
    }));
    process.exitCode = 1;
  } finally {
    await queueEvents.close();
    await queue.close();
    await redis.quit();
  }
}

runSmokeEnqueue().catch((err) => {
  console.error('[FATAL] Unhandled error during smoke job execution:', err);
  process.exit(1);
});
