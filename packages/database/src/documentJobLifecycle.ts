import { prisma } from './index.js';

export interface StartDocumentJobParams {
  jobId: string;
  materialId: string;
  userId: string;
  attempts: number;
}

export interface StartDocumentJobResult {
  canProcess: boolean;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'NOT_FOUND';
  errorCode?: string | null;
}

/**
 * Atomically transitions a document extraction job to PROCESSING.
 *
 * Guarantees:
 * 1. If material is soft-deleted, aborts immediately and marks job FAILED (MATERIAL_DELETED).
 * 2. If job was already COMPLETED or FAILED, aborts without modifying database (anti-resurrection).
 * 3. Transitions PENDING -> PROCESSING atomically under row lock.
 */
export async function startDocumentJobAtomically(
  params: StartDocumentJobParams
): Promise<StartDocumentJobResult> {
  const { jobId, materialId, userId, attempts } = params;

  return await prisma.$transaction(async (tx) => {
    const now = new Date();

    // 1. Verify material existence & soft-deletion under lock
    const matRows = await tx.$queryRaw<
      Array<{ id: string; status: string; deleted_at: Date | null }>
    >`
      SELECT id, status, deleted_at
      FROM materials
      WHERE id = ${materialId} AND user_id = ${userId}
      FOR UPDATE
    `;

    if (matRows.length === 0) {
      return { canProcess: false, status: 'NOT_FOUND' };
    }

    const material = matRows[0]!;
    if (material.deleted_at !== null) {
      // Material already deleted, mark job FAILED
      await tx.$executeRaw`
        UPDATE processing_jobs
        SET status = 'FAILED'::"ProcessingJobStatus",
            error_code = 'MATERIAL_DELETED',
            error_message = 'Materi telah dihapus sebelum pemrosesan ekstraksi dimulai.',
            failed_at = ${now},
            updated_at = ${now}
        WHERE id = ${jobId} AND status IN ('PENDING', 'PROCESSING')
      `;
      return { canProcess: false, status: 'FAILED', errorCode: 'MATERIAL_DELETED' };
    }

    // 2. Lock and verify processing_job
    const jobRows = await tx.$queryRaw<
      Array<{ id: string; status: string; attempts: number }>
    >`
      SELECT id, status::text as status, attempts
      FROM processing_jobs
      WHERE id = ${jobId} AND user_id = ${userId}
      FOR UPDATE
    `;

    if (jobRows.length === 0) {
      return { canProcess: false, status: 'NOT_FOUND' };
    }

    const currentJob = jobRows[0]!;
    if (currentJob.status === 'COMPLETED' || currentJob.status === 'FAILED') {
      // Already terminal: duplicate delivery or already cancelled!
      return {
        canProcess: false,
        status: currentJob.status as 'COMPLETED' | 'FAILED',
      };
    }

    // 3. Atomically transition to PROCESSING
    await tx.$executeRaw`
      UPDATE processing_jobs
      SET status = 'PROCESSING'::"ProcessingJobStatus",
          started_at = COALESCE(started_at, ${now}),
          attempts = ${attempts},
          updated_at = ${now}
      WHERE id = ${jobId} AND status IN ('PENDING', 'PROCESSING')
    `;

    // 4. Update material status to PROCESSING if it was QUEUED or UPLOADING
    await tx.$executeRaw`
      UPDATE materials
      SET status = 'PROCESSING',
          updated_at = ${now}
      WHERE id = ${materialId} AND status IN ('UPLOADING', 'QUEUED')
    `;

    return { canProcess: true, status: 'PROCESSING' };
  });
}

export interface FinishDocumentJobParams {
  jobId: string;
  materialId: string;
  userId: string;
  declaredBytes: number;
  actualBytes: number;
  pageCount: number;
  pages: Array<{
    pageNumber: number;
    extractedText: string;
    characterCount: number;
  }>;
  emptyPagesMessage?: string | null;
}

export interface FinishDocumentJobResult {
  wasCommitted: boolean;
  status: 'READY' | 'FAILED' | 'ALREADY_TERMINAL';
  errorCode?: string | null;
}

/**
 * Atomically commits successful document extraction:
 * 1. Checks that material is NOT soft-deleted.
 * 2. Transitions processing_jobs from PENDING/PROCESSING to COMPLETED.
 * 3. If and only if job was transitioned (first execution):
 *    - Updates materials to READY with actual bytes & page count.
 *    - Atomically transfers storage quota: decrements reservedBytes by declaredBytes
 *      and increments usedBytes by actualBytes.
 *    - Replaces material_pages idempotently.
 *
 * If duplicate execution runs, 0 rows are updated and quota is NOT modified.
 */
export async function finishDocumentJobAtomically(
  params: FinishDocumentJobParams
): Promise<FinishDocumentJobResult> {
  const {
    jobId,
    materialId,
    userId,
    declaredBytes,
    actualBytes,
    pageCount,
    pages,
    emptyPagesMessage,
  } = params;

  return await prisma.$transaction(async (tx) => {
    const now = new Date();

    // 1. Lock and check material
    const matRows = await tx.$queryRaw<
      Array<{ id: string; status: string; deleted_at: Date | null }>
    >`
      SELECT id, status, deleted_at
      FROM materials
      WHERE id = ${materialId} AND user_id = ${userId}
      FOR UPDATE
    `;

    if (matRows.length === 0 || matRows[0]?.deleted_at !== null) {
      // Material was deleted during extraction: abort without committing READY or storage quota
      await tx.$executeRaw`
        UPDATE processing_jobs
        SET status = 'FAILED'::"ProcessingJobStatus",
            error_code = 'MATERIAL_DELETED',
            error_message = 'Materi telah dihapus sebelum proses ekstraksi selesai.',
            failed_at = ${now},
            updated_at = ${now}
        WHERE id = ${jobId} AND status IN ('PENDING', 'PROCESSING')
      `;
      return {
        wasCommitted: false,
        status: 'FAILED',
        errorCode: 'MATERIAL_DELETED',
      };
    }

    // 2. Atomically transition processing_job to COMPLETED
    const updatedJobs = await tx.$queryRaw<Array<{ id: string }>>`
      UPDATE processing_jobs
      SET status = 'COMPLETED'::"ProcessingJobStatus",
          completed_at = ${now},
          updated_at = ${now}
      WHERE id = ${jobId}
        AND user_id = ${userId}
        AND status IN ('PENDING', 'PROCESSING')
      RETURNING id
    `;

    if (updatedJobs.length === 0) {
      // Job was already COMPLETED or FAILED (duplicate execution): DO NOT TOUCH QUOTA!
      return {
        wasCommitted: false,
        status: 'ALREADY_TERMINAL',
      };
    }

    // 3. Mark material READY
    await tx.$executeRaw`
      UPDATE materials
      SET status = 'READY',
          page_count = ${pageCount},
          bytes = ${actualBytes},
          error_code = NULL,
          error_message = ${emptyPagesMessage ?? null},
          updated_at = ${now}
      WHERE id = ${materialId} AND deleted_at IS NULL
    `;

    // 4. Atomically commit storage quota under row lock:
    // Decrement reservedBytes by declaredBytes (clamped to current reserved, not going negative)
    // Increment usedBytes by actualBytes
    await tx.$executeRaw`
      UPDATE storage_usages
      SET reserved_bytes = GREATEST(0, reserved_bytes - ${declaredBytes}),
          used_bytes = used_bytes + ${actualBytes},
          updated_at = ${now}
      WHERE user_id = ${userId}
    `;

    // 5. Replace material_pages
    await tx.$executeRaw`
      DELETE FROM material_pages WHERE material_id = ${materialId}
    `;

    if (pages.length > 0) {
      await tx.materialPage.createMany({
        data: pages.map((p) => ({
          materialId,
          pageNumber: p.pageNumber,
          extractedText: p.extractedText,
          characterCount: p.characterCount,
        })),
      });
    }

    return {
      wasCommitted: true,
      status: 'READY',
    };
  });
}

export interface FailDocumentJobParams {
  jobId: string;
  materialId: string;
  userId: string;
  declaredBytes: number;
  errorCode: string;
  errorMessage: string;
}

export interface FailDocumentJobResult {
  wasCommitted: boolean;
  status: 'FAILED' | 'ALREADY_TERMINAL';
}

/**
 * Atomically marks a document extraction job as FAILED (terminal failure):
 * 1. Transitions processing_job to FAILED if and only if it was currently PENDING or PROCESSING.
 * 2. If material is not deleted, updates material status to FAILED.
 * 3. Releases reservedBytes held for this job.
 *
 * Safe against duplicate execution and concurrent deletions.
 */
export async function failDocumentJobAtomically(
  params: FailDocumentJobParams
): Promise<FailDocumentJobResult> {
  const { jobId, materialId, userId, declaredBytes, errorCode, errorMessage } = params;

  return await prisma.$transaction(async (tx) => {
    const now = new Date();

    // 1. Lock material to check deletion
    const matRows = await tx.$queryRaw<
      Array<{ id: string; status: string; deleted_at: Date | null }>
    >`
      SELECT id, status, deleted_at
      FROM materials
      WHERE id = ${materialId} AND user_id = ${userId}
      FOR UPDATE
    `;

    const isDeleted = matRows.length === 0 || matRows[0]?.deleted_at !== null;

    // 2. Atomically transition job to FAILED
    const updatedJobs = await tx.$queryRaw<Array<{ id: string }>>`
      UPDATE processing_jobs
      SET status = 'FAILED'::"ProcessingJobStatus",
          error_code = ${errorCode},
          error_message = ${errorMessage},
          failed_at = ${now},
          updated_at = ${now}
      WHERE id = ${jobId}
        AND user_id = ${userId}
        AND status IN ('PENDING', 'PROCESSING')
      RETURNING id
    `;

    if (updatedJobs.length === 0) {
      // Already terminal
      return { wasCommitted: false, status: 'ALREADY_TERMINAL' };
    }

    if (!isDeleted) {
      // Update material to FAILED
      await tx.$executeRaw`
        UPDATE materials
        SET status = 'FAILED',
            error_code = ${errorCode},
            error_message = ${errorMessage},
            updated_at = ${now}
        WHERE id = ${materialId} AND deleted_at IS NULL
      `;

      // Release reservedBytes since document failed to become READY
      await tx.$executeRaw`
        UPDATE storage_usages
        SET reserved_bytes = GREATEST(0, reserved_bytes - ${declaredBytes}),
            updated_at = ${now}
        WHERE user_id = ${userId}
      `;
    }

    return { wasCommitted: true, status: 'FAILED' };
  });
}
