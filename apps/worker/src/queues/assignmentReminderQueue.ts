import { Worker, Job, Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { prisma } from '@studyflow/database';
import { QUEUE_NAMES } from '@studyflow/shared';
import {
  sendAssignmentReminderEmail,
  AssignmentReminderEmailParams,
} from '../services/emailAdapter.js';

export interface AssignmentReminderJobData {
  assignmentId: string;
  reminderType: 'D_MINUS_1';
  deadline: string; // ISO date string of assignment dueDate
}

export interface ProcessReminderResult {
  status: 'SENT' | 'SKIPPED' | 'FAILED' | 'CLAIM_FAILED' | 'ALREADY_SENT';
  reason?: string;
  logId?: string;
}

/**
 * Core processing logic for an assignment reminder job.
 * Atomic, idempotent, and transactional boundaries are strictly respected.
 * DB transactions are NEVER held during the external SMTP call.
 */
export async function processAssignmentReminderJob(
  jobOrData: { data: AssignmentReminderJobData },
  options?: {
    now?: Date;
    emailSender?: (params: AssignmentReminderEmailParams) => Promise<void>;
  }
): Promise<ProcessReminderResult> {
  const { assignmentId, reminderType, deadline: deadlineStr } = jobOrData.data;
  const targetDeadline = new Date(deadlineStr);
  const now = options?.now ? new Date(options.now) : new Date();
  const sendEmail = options?.emailSender || sendAssignmentReminderEmail;

  // 1. Fetch fresh state from the database
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      user: true,
      course: {
        include: {
          semester: true,
        },
      },
    },
  });

  // If assignment was deleted from DB
  if (!assignment) {
    const existingLog = await prisma.assignmentReminderLog.findUnique({
      where: {
        assignment_reminder_unique: {
          assignmentId,
          reminderType,
          deadline: targetDeadline,
        },
      },
    });
    if (existingLog) {
      await prisma.assignmentReminderLog.update({
        where: { id: existingLog.id },
        data: { status: 'SKIPPED', error: 'Tugas telah dihapus', updatedAt: now },
      });
    }
    return { status: 'SKIPPED', reason: 'Tugas telah dihapus' };
  }

  // 2. Atomic check/claim on the persistent reminder log
  let log = await prisma.assignmentReminderLog.findUnique({
    where: {
      assignment_reminder_unique: {
        assignmentId,
        reminderType,
        deadline: targetDeadline,
      },
    },
  });

  if (log) {
    if (log.status === 'SENT') {
      return { status: 'ALREADY_SENT', logId: log.id };
    }
    if (log.status === 'SKIPPED') {
      return { status: 'SKIPPED', reason: log.error || 'Already skipped', logId: log.id };
    }

    // Atomic claim: Transition from PENDING or FAILED to PROCESSING
    const claimResult = await prisma.assignmentReminderLog.updateMany({
      where: {
        id: log.id,
        status: { in: ['PENDING', 'FAILED'] },
      },
      data: {
        status: 'PROCESSING',
        updatedAt: now,
      },
    });

    if (claimResult.count === 0) {
      // Another worker claimed it or it transitioned to SENT/SKIPPED
      return { status: 'CLAIM_FAILED' };
    }
  } else {
    // Attempt atomic insertion with initial status PROCESSING
    try {
      log = await prisma.assignmentReminderLog.create({
        data: {
          assignmentId,
          userId: assignment ? assignment.userId : 'unknown',
          reminderType,
          deadline: targetDeadline,
          status: 'PROCESSING',
        },
      });
    } catch {
      // Unique constraint collision: another concurrent worker claimed it
      return { status: 'CLAIM_FAILED' };
    }
  }

  // Helper to mark log as SKIPPED
  async function markSkipped(reason: string): Promise<ProcessReminderResult> {
    if (log) {
      await prisma.assignmentReminderLog.update({
        where: { id: log.id },
        data: {
          status: 'SKIPPED',
          error: reason,
          updatedAt: now,
        },
      });
    }
    return { status: 'SKIPPED', reason, logId: log?.id };
  }

  // 3. Evaluate Eligibility Criteria (re-read fresh state)

  // Condition: Assignment deleted
  if (!assignment) {
    return markSkipped('Tugas telah dihapus');
  }

  // Condition: Assignment status is completed (DONE)
  if (assignment.status === 'DONE') {
    return markSkipped('Tugas sudah selesai');
  }

  // Condition: Deadline shifted/changed
  if (assignment.dueDate.getTime() !== targetDeadline.getTime()) {
    return markSkipped('Tenggat waktu tugas telah diubah');
  }

  // Condition: Course or semester archived
  if (assignment.course.archivedAt !== null || assignment.course.semester.archivedAt !== null) {
    return markSkipped('Mata kuliah atau semester diarsipkan');
  }

  // Condition: User opt-out / reminder preference disabled
  if (!assignment.user.reminderEmailDeadline) {
    return markSkipped('Preferensi pengingat email dinonaktifkan');
  }

  // Condition: User email not verified
  if (!assignment.user.emailVerifiedAt) {
    return markSkipped('Alamat email pengguna belum terverifikasi');
  }

  // 4. Timing Calculations (Instant UTC)
  const nowMs = now.getTime();
  const deadlineMs = targetDeadline.getTime();
  const targetSendMs = deadlineMs - 24 * 60 * 60 * 1000; // Exact H-1 (24 hours prior)

  // Rule: NEVER send after deadline has passed
  if (nowMs >= deadlineMs) {
    return markSkipped('Melewati tenggat waktu tugas');
  }

  // Rule: Late tolerance window. If worker recovered > 1 hour late from targetSendMs, mark SKIPPED
  if (nowMs > targetSendMs + 60 * 60 * 1000) {
    return markSkipped('Keterlambatan melebihi batas toleransi 1 jam');
  }

  // 5. Send Email via SMTP Adapter
  // Crucial Architecture Rule: SMTP network call is executed OUTSIDE any DB transaction
  try {
    await sendEmail({
      to: assignment.user.email,
      name: assignment.user.name,
      assignmentTitle: assignment.title,
      courseName: assignment.course.name,
      dueDate: assignment.dueDate,
      timezone: assignment.user.timezone,
      assignmentId: assignment.id,
    });

    // 6. Record Successful Dispatch in DB
    await prisma.assignmentReminderLog.update({
      where: { id: log.id },
      data: {
        status: 'SENT',
        sentAt: now,
        error: null,
        updatedAt: now,
      },
    });

    return { status: 'SENT', logId: log.id };
  } catch (err: any) {
    // 7. On Failure: Record FAILED in DB and re-throw to allow BullMQ retry
    await prisma.assignmentReminderLog.update({
      where: { id: log.id },
      data: {
        status: 'FAILED',
        error: err?.message || 'SMTP delivery failure',
        updatedAt: now,
      },
    });

    throw err;
  }
}

/**
 * Periodic Reconciliation Runner.
 * Scans active assignments, catches up jobs missed due to worker downtime or Redis crashes,
 * and skips assignments exceeding the 1-hour delay tolerance.
 */
export async function reconcileAssignmentReminders(options?: {
  now?: Date;
  queue?: Queue<AssignmentReminderJobData>;
  emailSender?: (params: AssignmentReminderEmailParams) => Promise<void>;
}): Promise<{ processed: number; skipped: number; enqueued: number }> {
  const now = options?.now ? new Date(options.now) : new Date();
  let processed = 0;
  let skipped = 0;
  let enqueued = 0;

  // Window: Assignments with dueDate in the upcoming 72 hours and not past deadline
  // Indexed query using [status, dueDate]
  const candidateAssignments = await prisma.assignment.findMany({
    where: {
      status: { in: ['TODO', 'IN_PROGRESS'] },
      dueDate: {
        gt: now, // Not yet past deadline
        lte: new Date(now.getTime() + 72 * 60 * 60 * 1000),
      },
      user: {
        reminderEmailDeadline: true,
        emailVerifiedAt: { not: null },
      },
      course: {
        archivedAt: null,
        semester: {
          archivedAt: null,
        },
      },
    },
    include: {
      user: true,
      course: {
        include: {
          semester: true,
        },
      },
      reminderLogs: {
        where: {
          reminderType: 'D_MINUS_1',
        },
      },
    },
    take: 100, // Batch limit for performance
  });

  for (const assignment of candidateAssignments) {
    const deadline = assignment.dueDate;
    const targetSendTime = deadline.getTime() - 24 * 60 * 60 * 1000;
    const existingLog = assignment.reminderLogs.find(
      (l) => l.deadline.getTime() === deadline.getTime()
    );

    // If already SENT or SKIPPED, ignore
    if (existingLog && (existingLog.status === 'SENT' || existingLog.status === 'SKIPPED')) {
      continue;
    }

    // Case A: Exceeded 1-hour tolerance
    if (now.getTime() > targetSendTime + 60 * 60 * 1000) {
      await prisma.assignmentReminderLog.upsert({
        where: {
          assignment_reminder_unique: {
            assignmentId: assignment.id,
            reminderType: 'D_MINUS_1',
            deadline,
          },
        },
        create: {
          assignmentId: assignment.id,
          userId: assignment.userId,
          reminderType: 'D_MINUS_1',
          deadline,
          status: 'SKIPPED',
          error: 'Keterlambatan melebihi batas toleransi 1 jam',
        },
        update: {
          status: 'SKIPPED',
          error: 'Keterlambatan melebihi batas toleransi 1 jam',
        },
      });
      skipped++;
      continue;
    }

    // Case B: In tolerance window (targetSendTime <= now <= targetSendTime + 1h)
    if (now.getTime() >= targetSendTime) {
      const res = await processAssignmentReminderJob(
        {
          data: {
            assignmentId: assignment.id,
            reminderType: 'D_MINUS_1',
            deadline: deadline.toISOString(),
          },
        },
        { now, emailSender: options?.emailSender }
      );
      if (res.status === 'SENT') processed++;
      if (res.status === 'SKIPPED') skipped++;
      continue;
    }

    // Case C: Future schedule (targetSendTime > now)
    if (options?.queue) {
      const delay = Math.max(0, targetSendTime - now.getTime());
      const jobId = `reminder-${assignment.id}-D_MINUS_1-${deadline.getTime()}`;
      await options.queue.add(
        'send-assignment-reminder',
        {
          assignmentId: assignment.id,
          reminderType: 'D_MINUS_1',
          deadline: deadline.toISOString(),
        },
        {
          jobId,
          delay,
        }
      );
      enqueued++;
    }
  }

  return { processed, skipped, enqueued };
}

/**
 * Creates and starts the BullMQ Worker for Assignment Deadline Reminders.
 */
export function createAssignmentReminderWorker(redisConnection: Redis): Worker {
  const worker = new Worker<AssignmentReminderJobData>(
    QUEUE_NAMES.assignmentReminder,
    async (job: Job<AssignmentReminderJobData>) => {
      return processAssignmentReminderJob(job);
    },
    {
      connection: redisConnection,
      concurrency: 5,
    }
  );

  worker.on('ready', () => {
    console.log(
      JSON.stringify({
        level: 'info',
        timestamp: new Date().toISOString(),
        message: `[Worker] Assignment reminder worker is ready and listening to queue: ${QUEUE_NAMES.assignmentReminder}`,
      })
    );
  });

  worker.on('error', (err) => {
    console.error(
      JSON.stringify({
        level: 'error',
        timestamp: new Date().toISOString(),
        message: '[Worker] Assignment reminder worker error',
        error: err.message,
      })
    );
  });

  return worker;
}
