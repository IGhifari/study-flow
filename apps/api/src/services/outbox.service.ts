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
      connectTimeout: 2500,
    });
    redisConnection.on('error', (err) => {
      if (env.NODE_ENV !== 'test') {
        console.warn('[OutboxDispatcher] Redis connection warning:', err.message);
      }
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

export interface DispatchOutboxOptions {
  /** Target a specific outbox event ID first */
  eventId?: string;
  /** Target pending outbox events for a specific aggregate ID first */
  aggregateId?: string;
  /** Maximum number of events to process in this invocation (default: 50) */
  limit?: number;
  /** Whether to include opportunistic backlog events after targeted events (default: true outside test) */
  includeBacklog?: boolean;
}

/**
 * Dispatches pending outbox events to BullMQ or executes direct cleanup.
 * Handles DOCUMENT_PROCESSING_REQUESTED, AI_SUMMARY_REQUESTED, AI_FLASHCARD_REQUESTED,
 * AI_QUIZ_REQUESTED, and DOCUMENT_CLEANUP_REQUESTED.
 */
export async function dispatchOutboxEvents(
  options?: DispatchOutboxOptions
): Promise<{ dispatched: number; failed: number }> {
  let dispatched = 0;
  let failed = 0;

  const limit = options?.limit ?? 50;
  const hasTarget = Boolean(options?.eventId || options?.aggregateId);

  let pendingEvents: Array<{
    id: string;
    aggregateId: string;
    eventType: string;
    payload: unknown;
    attempts: number;
  }> = [];

  if (hasTarget) {
    const targeted = await prisma.outboxEvent.findMany({
      where: {
        status: 'PENDING',
        attempts: { lt: 5 },
        ...(options?.eventId ? { id: options.eventId } : {}),
        ...(options?.aggregateId ? { aggregateId: options.aggregateId } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    pendingEvents.push(...targeted);

    const remainingSlots = limit - pendingEvents.length;
    const shouldIncludeBacklog = options?.includeBacklog ?? env.NODE_ENV !== 'test';
    if (shouldIncludeBacklog && remainingSlots > 0) {
      const targetedIds = pendingEvents.map((e) => e.id);
      const backlog = await prisma.outboxEvent.findMany({
        where: {
          status: 'PENDING',
          attempts: { lt: 5 },
          ...(targetedIds.length > 0 ? { id: { notIn: targetedIds } } : {}),
        },
        orderBy: { createdAt: 'asc' },
        take: remainingSlots,
      });
      pendingEvents.push(...backlog);
    }
  } else {
    pendingEvents = await prisma.outboxEvent.findMany({
      where: {
        status: 'PENDING',
        attempts: { lt: 5 }, // Cap at 5 attempts before requiring manual intervention
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

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
      } else if (
        event.eventType === 'AI_FLASHCARD_REQUESTED' ||
        event.eventType === 'AI_FLASHCARDS_REQUESTED'
      ) {
        const queue = getAiGenerationQueue();
        const jobId = payload.jobId || event.aggregateId;
        await queue.add(
          'generate-flashcards',
          {
            jobId,
            setId: payload.setId,
            materialId: payload.materialId,
            userId: payload.userId,
            targetCount: payload.targetCount,
          },
          {
            jobId,
          }
        );
      } else if (event.eventType === 'AI_QUIZ_REQUESTED') {
        const queue = getAiGenerationQueue();
        const jobId = payload.jobId || event.aggregateId;
        await queue.add(
          'generate-quiz',
          {
            jobId,
            quizId: payload.quizId,
            materialId: payload.materialId,
            userId: payload.userId,
            targetCount: payload.targetCount,
          },
          {
            jobId,
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

      await prisma.outboxEvent.updateMany({
        where: { id: event.id, status: 'PENDING' },
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

      const nextAttempts = event.attempts + 1;
      const nextStatus = nextAttempts >= 5 ? 'FAILED' : 'PENDING';

      await prisma.outboxEvent.updateMany({
        where: { id: event.id, status: 'PENDING', attempts: event.attempts },
        data: {
          attempts: { increment: 1 },
          status: nextStatus,
          lastError: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }

  return { dispatched, failed };
}

/**
 * Serverless-safe outbox flush helper to be awaited before sending the HTTP response.
 * Prioritizes the newly created event (`eventId` or `aggregateId`) with a small opportunistic
 * batch size and strict wall-clock timeout so Vercel Functions do not freeze before BullMQ
 * enqueue completes, while preventing slow/unreachable Redis from blocking user responses.
 */
export async function flushOutboxForRequest(options: {
  eventId?: string;
  aggregateId?: string;
  timeoutMs?: number;
}): Promise<{ dispatched: number; failed: number; timedOut?: boolean }> {
  const timeoutMs = options.timeoutMs ?? (env.NODE_ENV === 'test' ? 400 : 1500);
  let timer: NodeJS.Timeout | null = null;

  try {
    const dispatchPromise = dispatchOutboxEvents({
      eventId: options.eventId,
      aggregateId: options.aggregateId,
      limit: env.NODE_ENV === 'test' ? 1 : 3,
      includeBacklog: env.NODE_ENV !== 'test',
    });

    const timeoutPromise = new Promise<{ dispatched: number; failed: number; timedOut: boolean }>(
      (resolve) => {
        timer = setTimeout(() => {
          resolve({ dispatched: 0, failed: 0, timedOut: true });
        }, timeoutMs);
      }
    );

    return await Promise.race([dispatchPromise, timeoutPromise]);
  } catch (err) {
    if (env.NODE_ENV !== 'test') {
      console.warn(
        '[OutboxDispatcher] Request-scoped flush failed (will retry on next sweep):',
        err instanceof Error ? err.message : err
      );
    }
    return { dispatched: 0, failed: 1 };
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
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
