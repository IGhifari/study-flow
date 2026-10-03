import { createRedisConnection, createSmokeWorker } from './queues/smokeQueue.js';
import { env } from './config/env.js';

console.log(JSON.stringify({
  level: 'info',
  timestamp: new Date().toISOString(),
  message: 'Starting StudyFlow worker process...',
  environment: env.NODE_ENV,
}));

const redisConnection = createRedisConnection();
const smokeWorker = createSmokeWorker(redisConnection);

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
    await smokeWorker.close();
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
