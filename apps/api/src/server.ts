import './config/env.js';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from '@studyflow/database';
import { closeRedisClient } from './routes/ready.js';
import { closeRateLimitRedisClient } from './middleware/rateLimiter.js';
import { startOutboxDispatcherLoop, closeQueueConnections } from './services/outbox.service.js';
import { closeAssignmentReminderQueue } from './services/assignmentReminder.service.js';
import { Server } from 'node:http';

const app = createApp();

const server: Server = app.listen(env.PORT, () => {
  console.log(JSON.stringify({
    level: 'info',
    timestamp: new Date().toISOString(),
    message: `StudyFlow API server started`,
    port: env.PORT,
    environment: env.NODE_ENV,
  }));

  // Start outbox dispatch loop. Must also run when NODE_ENV=test: unit tests
  // never import server.ts (entry-only module), and the E2E test server needs
  // document/AI jobs to reach BullMQ queues.
  startOutboxDispatcherLoop(5000);
});

let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(JSON.stringify({
    level: 'info',
    timestamp: new Date().toISOString(),
    message: `Received ${signal}. Starting graceful shutdown...`,
  }));

  // Force shutdown after 10s if not closed
  const forceExit = setTimeout(() => {
    console.error(JSON.stringify({
      level: 'error',
      timestamp: new Date().toISOString(),
      message: 'Graceful shutdown timed out. Forcing process exit.',
    }));
    process.exit(1);
  }, 10000);

  // Close HTTP server to stop accepting new requests
  server.close(async () => {
    console.log(JSON.stringify({
      level: 'info',
      timestamp: new Date().toISOString(),
      message: 'HTTP server closed. Disconnecting dependencies...',
    }));

    try {
      await Promise.all([
        prisma.$disconnect(),
        closeRedisClient(),
        closeQueueConnections(),
        closeAssignmentReminderQueue(),
        closeRateLimitRedisClient(),
      ]);
      console.log(JSON.stringify({
        level: 'info',
        timestamp: new Date().toISOString(),
        message: 'Dependencies disconnected cleanly. Goodbye.',
      }));
      clearTimeout(forceExit);
      process.exit(0);
    } catch (err) {
      console.error(JSON.stringify({
        level: 'error',
        timestamp: new Date().toISOString(),
        message: 'Error during dependencies disconnect',
      }));
      clearTimeout(forceExit);
      process.exit(1);
    }
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error(JSON.stringify({
    level: 'fatal',
    timestamp: new Date().toISOString(),
    message: 'Uncaught exception',
    error: err.message,
    stack: err.stack,
  }));
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error(JSON.stringify({
    level: 'fatal',
    timestamp: new Date().toISOString(),
    message: 'Unhandled promise rejection',
    reason: String(reason),
  }));
  gracefulShutdown('unhandledRejection');
});
