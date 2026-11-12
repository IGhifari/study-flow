import { prisma, Prisma } from './index.js';

export const AI_JOB_TYPES = [
  'AI_SUMMARY_GENERATION',
  'AI_FLASHCARD_GENERATION',
  'AI_QUIZ_GENERATION',
] as const;

export type AiJobType = (typeof AI_JOB_TYPES)[number];

export function isAiJobType(type: string): type is AiJobType {
  return (AI_JOB_TYPES as readonly string[]).includes(type);
}

/**
 * Decrements the user's active concurrent AI jobs count safely (standalone fallback).
 */
export async function decrementActiveJobsCount(userId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE ai_usages
    SET active_jobs_count = GREATEST(0, active_jobs_count - 1),
        updated_at = NOW()
    WHERE user_id = ${userId} AND active_jobs_count > 0
  `;
}

export interface CancelMaterialJobsParams {
  materialId: string;
  userId: string;
  tx?: Prisma.TransactionClient;
  errorCode?: string;
  errorMessage?: string;
}

export interface CancelMaterialJobsResult {
  cancelledAiJobCount: number;
  cancelledAiJobIds: string[];
  cancelledNonAiJobCount: number;
  cancelledNonAiJobIds: string[];
}

/**
 * Atomically cancels active jobs associated with a material and releases AI slots
 * if and only if active AI jobs were cancelled.
 *
 * Runs in the specified transaction `tx`, or a new transaction if none provided.
 */
export async function cancelMaterialJobsAtomically(
  params: CancelMaterialJobsParams
): Promise<CancelMaterialJobsResult> {
  const { materialId, userId, tx: externalTx, errorCode, errorMessage } = params;

  const execute = async (tx: Prisma.TransactionClient): Promise<CancelMaterialJobsResult> => {
    const now = new Date();
    const errCode = errorCode ?? 'MATERIAL_DELETED';
    const errMsg = errorMessage ?? 'Materi telah dihapus oleh pengguna';

    // 1. Cancel active AI jobs (PENDING, PROCESSING)
    const cancelledAiRows = await tx.$queryRaw<Array<{ id: string }>>`
      UPDATE processing_jobs
      SET status = 'FAILED'::"ProcessingJobStatus",
          error_code = ${errCode},
          error_message = ${errMsg},
          failed_at = ${now},
          updated_at = ${now}
      WHERE material_id = ${materialId}
        AND user_id = ${userId}
        AND status IN ('PENDING', 'PROCESSING')
        AND type::text IN ('AI_SUMMARY_GENERATION', 'AI_FLASHCARD_GENERATION', 'AI_QUIZ_GENERATION')
      RETURNING id
    `;

    // 2. Cancel active non-AI jobs (e.g. DOCUMENT_EXTRACTION, DOCUMENT_CLEANUP)
    const cancelledNonAiRows = await tx.$queryRaw<Array<{ id: string }>>`
      UPDATE processing_jobs
      SET status = 'FAILED'::"ProcessingJobStatus",
          error_code = ${errCode},
          error_message = ${errMsg},
          failed_at = ${now},
          updated_at = ${now}
      WHERE material_id = ${materialId}
        AND user_id = ${userId}
        AND status IN ('PENDING', 'PROCESSING')
        AND type::text NOT IN ('AI_SUMMARY_GENERATION', 'AI_FLASHCARD_GENERATION', 'AI_QUIZ_GENERATION')
      RETURNING id
    `;

    const cancelledAiJobCount = cancelledAiRows.length;
    const cancelledAiJobIds = cancelledAiRows.map((r) => r.id);
    const cancelledNonAiJobCount = cancelledNonAiRows.length;
    const cancelledNonAiJobIds = cancelledNonAiRows.map((r) => r.id);

    // 3. Atomically decrement AI slots by the exact count of cancelled active AI jobs
    if (cancelledAiJobCount > 0) {
      await tx.$executeRaw`
        UPDATE ai_usages
        SET active_jobs_count = GREATEST(0, active_jobs_count - ${cancelledAiJobCount}),
            updated_at = ${now}
        WHERE user_id = ${userId}
      `;
    }

    return {
      cancelledAiJobCount,
      cancelledAiJobIds,
      cancelledNonAiJobCount,
      cancelledNonAiJobIds,
    };
  };

  if (externalTx) {
    return await execute(externalTx);
  }
  return await prisma.$transaction(execute);
}

export interface FinishAiJobParams {
  jobId: string;
  userId: string;
  status: 'COMPLETED' | 'FAILED';
  errorCode?: string | null;
  errorMessage?: string | null;
  payload?: Record<string, unknown>;
  materialId?: string;
  onSuccessTx?: (tx: Prisma.TransactionClient) => Promise<void>;
  tx?: Prisma.TransactionClient;
}

export interface FinishAiJobResult {
  wasSlotReleased: boolean;
  status: 'COMPLETED' | 'FAILED' | 'ALREADY_TERMINAL';
}

/**
 * Atomically finishes an AI processing job (COMPLETED or FAILED) and releases
 * the active job slot if and only if the job was currently in PENDING or PROCESSING.
 *
 * Guarantees:
 * 1. Slot is released exactly once.
 * 2. If the material was soft-deleted, COMPLETED is blocked, job is failed with MATERIAL_DELETED,
 *    and onSuccessTx is NOT executed.
 * 3. If job was already COMPLETED or FAILED, returns wasSlotReleased = false without decrementing slot.
 */
export async function finishAiJobAtomically(
  params: FinishAiJobParams
): Promise<FinishAiJobResult> {
  const {
    jobId,
    userId,
    status,
    errorCode,
    errorMessage,
    payload,
    materialId,
    onSuccessTx,
    tx: externalTx,
  } = params;

  const execute = async (tx: Prisma.TransactionClient): Promise<FinishAiJobResult> => {
    const now = new Date();
    let targetStatus = status;
    let targetErrorCode = errorCode ?? null;
    let targetErrorMessage = errorMessage ?? null;

    // Check material soft-delete status if materialId is provided
    if (materialId) {
      const materialRows = await tx.$queryRaw<Array<{ deleted_at: Date | null }>>`
        SELECT deleted_at FROM materials WHERE id = ${materialId} AND user_id = ${userId} FOR UPDATE
      `;
      const isMaterialDeleted =
        materialRows.length === 0 || materialRows[0]?.deleted_at !== null;

      if (isMaterialDeleted) {
        // Material was deleted during processing: do NOT complete or persist!
        targetStatus = 'FAILED';
        targetErrorCode = 'MATERIAL_DELETED';
        targetErrorMessage =
          'Materi telah dihapus sebelum atau selama proses pembuatan AI.';
      }
    }

    // Atomically transition job status from PENDING or PROCESSING
    const rowsUpdated = await tx.$queryRaw<Array<{ id: string; type: string }>>`
      UPDATE processing_jobs
      SET status = ${targetStatus}::"ProcessingJobStatus",
          error_code = ${targetErrorCode},
          error_message = ${targetErrorMessage},
          completed_at = ${targetStatus === 'COMPLETED' ? now : null},
          failed_at = ${targetStatus === 'FAILED' ? now : null},
          payload = COALESCE(${payload ? JSON.stringify(payload) : null}::jsonb, payload),
          updated_at = ${now}
      WHERE id = ${jobId}
        AND user_id = ${userId}
        AND status IN ('PENDING', 'PROCESSING')
      RETURNING id, type::text as type
    `;

    const wasSlotReleased = rowsUpdated.length === 1;

    if (wasSlotReleased) {
      const jobType = rowsUpdated[0]?.type;
      const isAiJob = jobType ? isAiJobType(jobType) : true;

      if (isAiJob) {
        // Decrement active AI job slot exactly once
        await tx.$executeRaw`
          UPDATE ai_usages
          SET active_jobs_count = GREATEST(0, active_jobs_count - 1),
              updated_at = ${now}
          WHERE user_id = ${userId} AND active_jobs_count > 0
        `;
      }

      // Execute onSuccessTx if provided and material was not deleted
      if (onSuccessTx && targetErrorCode !== 'MATERIAL_DELETED') {
        await onSuccessTx(tx);
      }

      return { wasSlotReleased: true, status: targetStatus };
    }

    return { wasSlotReleased: false, status: 'ALREADY_TERMINAL' };
  };

  if (externalTx) {
    return await execute(externalTx);
  }
  return await prisma.$transaction(execute);
}

export interface ReconcileOptions {
  userId?: string;
  dryRun?: boolean; // Defaults to true
}

export interface UserReconciliationDetail {
  userId: string;
  recordedActiveJobs: number;
  actualActiveJobs: number;
  discrepancy: number; // recorded - actual
  action: 'NO_CHANGE' | 'WOULD_REPAIR' | 'REPAIRED';
}

export interface ReconcileReport {
  dryRun: boolean;
  totalUsersChecked: number;
  discrepanciesFound: number;
  details: UserReconciliationDetail[];
}

/**
 * Reconciles activeJobsCount against active AI jobs in processing_jobs.
 *
 * Defaults to dry-run mode (dryRun: true). Pass dryRun: false to apply fixes.
 * Safe against concurrent reservations/finalizations via row-level locking.
 * Does NOT reset counters to zero blindly; computes exact active jobs per user.
 */
export async function reconcileAiJobSlots(
  options: ReconcileOptions = {}
): Promise<ReconcileReport> {
  const dryRun = options.dryRun ?? true;
  const targetUserId = options.userId;

  let candidateUserIds: string[] = [];
  if (targetUserId) {
    candidateUserIds = [targetUserId];
  } else {
    // Find all users who have an ai_usages row or active AI jobs
    const usersWithUsage = await prisma.aiUsage.findMany({
      select: { userId: true },
    });
    const usersWithJobs = await prisma.processingJob.findMany({
      where: {
        status: { in: ['PENDING', 'PROCESSING'] },
        type: {
          in: [
            'AI_SUMMARY_GENERATION',
            'AI_FLASHCARD_GENERATION',
            'AI_QUIZ_GENERATION',
          ],
        },
      },
      select: { userId: true },
      distinct: ['userId'],
    });

    const set = new Set<string>();
    usersWithUsage.forEach((u) => set.add(u.userId));
    usersWithJobs.forEach((u) => set.add(u.userId));
    candidateUserIds = Array.from(set);
  }

  const details: UserReconciliationDetail[] = [];
  let discrepanciesFound = 0;

  for (const uid of candidateUserIds) {
    await prisma.$transaction(async (tx) => {
      const now = new Date();

      // Ensure ai_usages row exists and lock it
      await tx.$executeRaw`
        INSERT INTO ai_usages (id, user_id, daily_generation_count, active_jobs_count, last_reset_utc, created_at, updated_at)
        VALUES (gen_random_uuid(), ${uid}, 0, 0, ${now}, ${now}, ${now})
        ON CONFLICT (user_id) DO NOTHING
      `;

      const usageRows = await tx.$queryRaw<Array<{ active_jobs_count: number }>>`
        SELECT active_jobs_count FROM ai_usages WHERE user_id = ${uid} FOR UPDATE
      `;
      const recordedActiveJobs = usageRows[0]?.active_jobs_count ?? 0;

      // Count actual active AI jobs in processing_jobs
      const countRows = await tx.$queryRaw<Array<{ count: bigint | number }>>`
        SELECT COUNT(*)::int AS count
        FROM processing_jobs
        WHERE user_id = ${uid}
          AND status IN ('PENDING', 'PROCESSING')
          AND type::text IN ('AI_SUMMARY_GENERATION', 'AI_FLASHCARD_GENERATION', 'AI_QUIZ_GENERATION')
      `;
      const actualActiveJobs = Number(countRows[0]?.count ?? 0);

      const discrepancy = recordedActiveJobs - actualActiveJobs;

      if (discrepancy === 0) {
        details.push({
          userId: uid,
          recordedActiveJobs,
          actualActiveJobs,
          discrepancy: 0,
          action: 'NO_CHANGE',
        });
      } else {
        discrepanciesFound++;
        if (dryRun) {
          details.push({
            userId: uid,
            recordedActiveJobs,
            actualActiveJobs,
            discrepancy,
            action: 'WOULD_REPAIR',
          });
        } else {
          // Explicit repair under row lock
          await tx.$executeRaw`
            UPDATE ai_usages
            SET active_jobs_count = ${actualActiveJobs},
                updated_at = ${now}
            WHERE user_id = ${uid}
          `;
          details.push({
            userId: uid,
            recordedActiveJobs,
            actualActiveJobs,
            discrepancy,
            action: 'REPAIRED',
          });
        }
      }
    });
  }

  return {
    dryRun,
    totalUsersChecked: candidateUserIds.length,
    discrepanciesFound,
    details,
  };
}
