import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { QUEUE_NAMES } from '@studyflow/shared';
import { env } from '../config/env.js';

let reminderQueue: Queue | null = null;
let redisConnection: Redis | null = null;

function getQueueConnection(): Redis {
  if (!redisConnection) {
    redisConnection = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  }
  return redisConnection;
}

export function getAssignmentReminderQueue(): Queue {
  if (!reminderQueue) {
    reminderQueue = new Queue(QUEUE_NAMES.assignmentReminder, {
      connection: getQueueConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
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
  return reminderQueue;
}

/**
 * Schedules a delayed BullMQ reminder job for an assignment.
 * Target send time is exactly 24 hours prior to deadline (H-1).
 * If task is DONE or H-1 is already in the past, no job is scheduled.
 */
export async function scheduleAssignmentReminder(assignment: {
  id: string;
  dueDate: Date;
  status: string;
}): Promise<void> {
  // If assignment is completed, do not schedule
  if (assignment.status === 'DONE') {
    return;
  }

  const nowMs = Date.now();
  const deadlineMs = assignment.dueDate.getTime();
  const targetSendMs = deadlineMs - 24 * 60 * 60 * 1000;

  // Rule: New assignments created after H-1 do not trigger retroactive catchup reminder
  if (targetSendMs <= nowMs) {
    return;
  }

  const delay = targetSendMs - nowMs;
  const jobId = `reminder-${assignment.id}-D_MINUS_1-${deadlineMs}`;

  try {
    const queue = getAssignmentReminderQueue();
    await queue.add(
      'send-assignment-reminder',
      {
        assignmentId: assignment.id,
        reminderType: 'D_MINUS_1',
        deadline: assignment.dueDate.toISOString(),
      },
      {
        jobId,
        delay,
      }
    );
  } catch (err: any) {
    // Graceful logging if queue connection is not available in isolated test environments
    if (env.NODE_ENV !== 'test') {
      console.warn(`[AssignmentReminder] Failed to schedule reminder for ${assignment.id}: ${err?.message}`);
    }
  }
}

export async function closeAssignmentReminderQueue(): Promise<void> {
  if (reminderQueue) {
    await reminderQueue.close();
    reminderQueue = null;
  }
  if (redisConnection) {
    await redisConnection.quit().catch(() => redisConnection?.disconnect());
    redisConnection = null;
  }
}
