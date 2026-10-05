import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { prisma } from '@studyflow/database';
import { QUEUE_NAMES } from '@studyflow/shared';
import { env } from '../config/env.js';
import { getStorageAdapter } from './storage.service.js';
import { sweepAbandonedUploads } from './material.service.js';

let documentQueue: Queue | null = null;
let aiQueue: Queue | null = null;
let redisConnection: Redis | null = null;
let outboxLoopTimer: NodeJS.Timeout | null = null;
let lastSweepTime = 0;

function getQueueConnection(): Redis {
  if (!redisConnection) {
    redisConnection = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  }
  return redisConnection;
}

export function getDocumentProcessingQueue(): Queue {
  if (!documentQueue) {
    documentQueue = new Queue(QUEUE_NAMES.documentProcessing, {
      connection: getQueueConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          count: 100,
        },
        removeOnFail: {
          count: 200,
        },
      },
    });
  }
  return documentQueue;
}

export function getAiGenerationQueue(): Queue {
  if (!aiQueue) {
    aiQueue = new Queue(QUEUE_NAMES.aiGeneration, {
      connection: getQueueConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
        removeOnComplete: {
          count: 100,
        },
        removeOnFail: {
          count: 200,
        },
      },
    });
  }
  return aiQueue;
}

/**
 * Dispatches pending outbox events to BullMQ or executes direct cleanup.
 * Handles DOCUMENT_PROCESSING_REQUESTED, AI_SUMMARY_REQUESTED, and DOCUMENT_CLEANUP_REQUESTED.
 */
export async function dispatchOutboxEvents(): Promise<{ dispatched: number; failed: number }> {
  let dispatched = 0;
  let failed = 0;

  const pendingEvents = await prisma.outboxEvent.findMany({
    where: {
      status: 'PENDING',
      attempts: { lt: 5 }, // Cap at 5 attempts before requiring manual intervention
    },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });

  if (pendingEvents.length === 0) {
    return { dispatched: 0, failed: 0 };
  }

  for (const event of pendingEvents) {
    try {
      const payload = event.payload as any;

      if (event.eventType === 'DOCUMENT_PROCESSING_REQUESTED') {
        const queue = getDocumentProcessingQueue();
        const jobId = payload.jobId || event.aggregateId;
        await queue.add(
          'process-document',
          {
            jobId,
            materialId: payload.materialId,
            userId: payload.userId,
            storageKey: payload.storageKey,
            declaredBytes: payload.declaredBytes,
          },
          {
            jobId, // Stable idempotency key in BullMQ
          }
        );
      } else if (event.eventType === 'AI_SUMMARY_REQUESTED') {
        const queue = getAiGenerationQueue();
        const jobId = payload.jobId || event.aggregateId;
        await queue.add(
          'generate-summary',
          {
            jobId,
            summaryId: payload.summaryId,
            materialId: payload.materialId,
            userId: payload.userId,
            isRegeneration: payload.isRegeneration,
          },
          {
            jobId, // Stable idempotency key in BullMQ
          }
        );
      } else if (event.eventType === 'DOCUMENT_CLEANUP_REQUESTED') {
        // Execute background storage object cleanup with retry
        const storageAdapter = getStorageAdapter();
        const removeRes = await storageAdapter.remove([payload.storageKey]);
        if (removeRes.error) {
          throw removeRes.error;
        }
      }

      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });

      dispatched++;
    } catch (err: any) {
      failed++;
      console.error(
        `[OutboxDispatcher] Failed to dispatch event ${event.id}:`,
        err instanceof Error ? err.message : err
      );

      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          attempts: { increment: 1 },
          lastError: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }

  return { dispatched, failed };
}

/**
 * Starts continuous background loop for sweeping pending outbox events
 * and periodically running abandoned upload cleanup.
 */
export function startOutboxDispatcherLoop(intervalMs = 5000): void {
  if (outboxLoopTimer) return;

  const runSweep = async () => {
    try {
      await dispatchOutboxEvents();

      // Sweep abandoned uploads every 10 minutes
      const now = Date.now();
      if (now - lastSweepTime > 10 * 60 * 1000) {
        lastSweepTime = now;
        await sweepAbandonedUploads().catch(console.error);
      }
    } catch (err) {
      console.error('[OutboxLoop] Error in dispatcher sweep:', err);
    } finally {
      if (outboxLoopTimer !== null) {
        outboxLoopTimer = setTimeout(runSweep, intervalMs);
      }
    }
  };

  outboxLoopTimer = setTimeout(runSweep, intervalMs);
}

export function stopOutboxDispatcherLoop(): void {
  if (outboxLoopTimer) {
    clearTimeout(outboxLoopTimer);
    outboxLoopTimer = null;
  }
}

export async function closeQueueConnections(): Promise<void> {
  stopOutboxDispatcherLoop();

  if (documentQueue) {
    await documentQueue.close();
    documentQueue = null;
  }
  if (aiQueue) {
    await aiQueue.close();
    aiQueue = null;
  }
  if (redisConnection) {
    await redisConnection.quit().catch(() => redisConnection?.disconnect());
    redisConnection = null;
  }
}
