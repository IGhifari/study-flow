import { Router, Request, Response } from 'express';
import { ReadinessResponse, DependencyStatus } from '@studyflow/shared';
import { prisma } from '@studyflow/database';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';

export const readyRouter = Router();

// Create a redis client for readiness checks
let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: () => null, // don't auto retry indefinitely for readiness
    });
  }
  return redisClient;
}

export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      redisClient.disconnect();
    }
    redisClient = null;
  }
}

async function checkWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('Operation timed out'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

async function checkDatabase(timeoutMs = 2000): Promise<DependencyStatus> {
  const start = Date.now();
  try {
    await checkWithTimeout(prisma.$queryRaw`SELECT 1`, timeoutMs);
    return {
      status: 'up',
      latencyMs: Date.now() - start,
    };
  } catch {
    return {
      status: 'down',
      latencyMs: null,
      message: 'Database check failed or timed out',
    };
  }
}

async function checkRedis(timeoutMs = 2000): Promise<DependencyStatus> {
  const start = Date.now();
  try {
    const client = getRedisClient();
    if (client.status !== 'ready' && client.status !== 'connecting') {
      await client.connect();
    }
    const pong = await checkWithTimeout(client.ping(), timeoutMs);
    if (pong === 'PONG') {
      return {
        status: 'up',
        latencyMs: Date.now() - start,
      };
    }
    return {
      status: 'down',
      latencyMs: null,
      message: 'Unexpected Redis ping response',
    };
  } catch {
    return {
      status: 'down',
      latencyMs: null,
      message: 'Redis connection failed or timed out',
    };
  }
}

readyRouter.get('/', async (_req: Request, res: Response) => {
  const [dbStatus, redisStatus] = await Promise.all([
    checkDatabase(),
    checkRedis(),
  ]);

  const isHealthy = dbStatus.status === 'up' && redisStatus.status === 'up';

  const response: ReadinessResponse = {
    status: isHealthy ? 'ok' : 'down',
    timestamp: new Date().toISOString(),
    service: 'studyflow-api',
    dependencies: {
      database: dbStatus,
      redis: redisStatus,
    },
  };

  const statusCode = isHealthy ? 200 : 503;
  res.status(statusCode).json(response);
});
