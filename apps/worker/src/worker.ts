import { createRedisConnection, createSmokeWorker } from './queues/smokeQueue.js';
import { processDocumentJob } from './queues/documentQueue.js';
import {
  processAiSummaryJob,
  processAiFlashcardJob,
  processAiQuizJob,
} from './queues/aiQueue.js';
import {
  createAssignmentReminderQueue,
  createAssignmentReminderWorker,
  reconcileAssignmentReminders,
} from './queues/assignmentReminderQueue.js';
import { Worker, Job } from 'bullmq';
import { prisma } from '@studyflow/database';
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
const smokeWorker = createSmokeWorker(createRedisConnection());
const reminderQueue = createAssignmentReminderQueue(createRedisConnection());
const reminderWorker = createAssignmentReminderWorker(createRedisConnection());

// Initial non-blocking reconciliation on startup
reconcileAssignmentReminders({ queue: reminderQueue }).catch((err) => {
  console.error(JSON.stringify({
    level: 'error',
    timestamp: new Date().toISOString(),
    message: '[Worker] Initial reminder reconciliation error',
    error: err?.message,
  }));
});

// Periodic reconciliation every 15 minutes
const reconciliationInterval = setInterval(() => {
  reconcileAssignmentReminders({ queue: reminderQueue }).catch((err) => {
    console.error(JSON.stringify({
      level: 'error',
      timestamp: new Date().toISOString(),
      message: '[Worker] Periodic reminder reconciliation error',
      error: err?.message,
    }));
  });
}, 15 * 60 * 1000);

const documentWorker = new Worker(
  QUEUE_NAMES.documentProcessing,
  processDocumentJob,
  {
    connection: createRedisConnection(),
    concurrency: 2, // Concurrency limit for document processing per PRD
  }
);

async function handleAiJob(job: Job<any, any>): Promise<any> {
  if (job.name === 'generate-flashcards' || job.data?.setId) {
    return processAiFlashcardJob(job);
  }
  if (job.name === 'generate-quiz' || job.data?.quizId) {
    return processAiQuizJob(job);
  }
  return processAiSummaryJob(job);
}

const aiWorker = new Worker(
  QUEUE_NAMES.aiGeneration,
  handleAiJob,
  {
    connection: createRedisConnection(),
    concurrency: 1, // Safe concurrency limit for free tier AI generation
    limiter: {
      max: 10, // Global limiter: maximum 10 AI generation jobs per minute across all users
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

  clearInterval(reconciliationInterval);

  try {
    await Promise.all([
      smokeWorker.close(),
      documentWorker.close(),
      aiWorker.close(),
      reminderWorker.close(),
      reminderQueue.close(),
    ]);
    await redisConnection.quit();
    await prisma.$disconnect();

    console.log(JSON.stringify({
      level: 'info',
      timestamp: new Date().toISOString(),
      message: 'Worker, Redis, and Database connections closed cleanly. Goodbye.',
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
