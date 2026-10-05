import { createRedisConnection, createSmokeWorker } from './queues/smokeQueue.js';
import { processDocumentJob } from './queues/documentQueue.js';
import { processAiSummaryJob } from './queues/aiQueue.js';
import { Worker } from 'bullmq';
import { QUEUE_NAMES } from '@studyflow/shared';
import { env } from './config/env.js';

import { globalAiRateLimiter } from './services/aiRateLimiter.js';

console.log(JSON.stringify({
  level: 'info',
  timestamp: new Date().toISOString(),
  message: 'Starting StudyFlow worker process...',
  environment: env.NODE_ENV,
}));

const redisConnection = createRedisConnection();
globalAiRateLimiter.setRedisClient(redisConnection);
const smokeWorker = createSmokeWorker(redisConnection);

const documentWorker = new Worker(
  QUEUE_NAMES.documentProcessing,
  processDocumentJob,
  {
    connection: redisConnection,
    concurrency: 2, // Concurrency limit for document processing per PRD
  }
);

const aiWorker = new Worker(
  QUEUE_NAMES.aiGeneration,
  processAiSummaryJob,
  {
    connection: redisConnection,
    concurrency: 1, // Safe concurrency limit for free tier AI generation
    limiter: {
      max: 10, // Global limiter: maximum 10 summary jobs per minute across all users
      duration: 60000,
    },
  }
);

documentWorker.on('ready', () => {
  console.log(JSON.stringify({
    level: 'info',
    timestamp: new Date().toISOString(),
    message: `[Worker] Document worker is ready and listening to queue: ${QUEUE_NAMES.documentProcessing}`,
  }));
});

documentWorker.on('error', (err) => {
  console.error(JSON.stringify({
    level: 'error',
    timestamp: new Date().toISOString(),
    message: '[Worker] Document worker error',
    error: err.message,
  }));
});

aiWorker.on('ready', () => {
  console.log(JSON.stringify({
    level: 'info',
    timestamp: new Date().toISOString(),
    message: `[Worker] AI generation worker is ready and listening to queue: ${QUEUE_NAMES.aiGeneration}`,
  }));
});

aiWorker.on('error', (err) => {
  console.error(JSON.stringify({
    level: 'error',
    timestamp: new Date().toISOString(),
    message: '[Worker] AI generation worker error',
    error: err.message,
  }));
});

let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(JSON.stringify({
    level: 'info',
    timestamp: new Date().toISOString(),
    message: `Received ${signal}. Shutting down worker gracefully...`,
  }));

  const forceExit = setTimeout(() => {
    console.error(JSON.stringify({
      level: 'error',
      timestamp: new Date().toISOString(),
      message: 'Worker shutdown timed out. Forcing process exit.',
    }));
    process.exit(1);
  }, 10000);

  try {
    await Promise.all([
      smokeWorker.close(),
      documentWorker.close(),
      aiWorker.close(),
    ]);
    await redisConnection.quit();

    console.log(JSON.stringify({
      level: 'info',
      timestamp: new Date().toISOString(),
      message: 'Worker and Redis connection closed cleanly. Goodbye.',
    }));

    clearTimeout(forceExit);
    process.exit(0);
  } catch (err) {
    console.error(JSON.stringify({
      level: 'error',
      timestamp: new Date().toISOString(),
      message: 'Error during worker shutdown',
      error: err instanceof Error ? err.message : String(err),
    }));
    clearTimeout(forceExit);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error(JSON.stringify({
    level: 'fatal',
    timestamp: new Date().toISOString(),
    message: 'Worker uncaught exception',
    error: err.message,
    stack: err.stack,
  }));
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error(JSON.stringify({
    level: 'fatal',
    timestamp: new Date().toISOString(),
    message: 'Worker unhandled promise rejection',
    reason: String(reason),
  }));
  gracefulShutdown('unhandledRejection');
});
