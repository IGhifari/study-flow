import crypto from 'node:crypto';
import { prisma } from '@studyflow/database';
import {
  MaterialSummary,
  AiQuotaStatus,
  AI_SUMMARY_LIMITS,
} from '@studyflow/shared';
import { AppError } from '../middleware/errorHandler.js';
import { env } from '../config/env.js';
import {
  checkAndReserveAiQuota,
  getUserAiQuotaStatus,
  AiQuotaError,
} from './aiQuota.service.js';
import { dispatchOutboxEvents } from './outbox.service.js';

function createError(statusCode: number, code: string, message: string): AppError {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

export function formatAiQuotaStatus(usage: {
  dailyCount: number;
  dailyLimit: number;
  activeJobs: number;
  maxConcurrent: number;
  lastResetUtc: string;
}): AiQuotaStatus {
  return {
    dailyLimit: usage.dailyLimit,
    dailyUsed: usage.dailyCount,
    dailyRemaining: Math.max(0, usage.dailyLimit - usage.dailyCount),
    activeJobsLimit: usage.maxConcurrent,
    activeJobsCount: usage.activeJobs,
    resetUtc: usage.lastResetUtc,
  };
}

export function toSummaryResponse(s: any): MaterialSummary {
  return {
    id: s.id,
    userId: s.userId,
    materialId: s.materialId,
    status: s.status,
    title: s.title ?? null,
    overview: s.overview ?? null,
    keyConcepts: s.keyConcepts ?? null,
    sections: s.sections ?? null,
    keyTerms: s.keyTerms ?? null,
    limitations: s.limitations ?? null,
    provider: s.provider,
    model: s.model,
    promptVersion: s.promptVersion,
    sourcePageCount: s.sourcePageCount,
    sourceCharacterCount: s.sourceCharacterCount,
    inputTokens: s.inputTokens ?? null,
    outputTokens: s.outputTokens ?? null,
    durationMs: s.durationMs ?? null,
    activeJobId: s.activeJobId ?? null,
    errorCode: s.errorCode ?? null,
    errorMessage: s.errorMessage ?? null,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
    updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt,
  };
}

/**
 * Requests generation of an AI summary for a material.
 * Enforces ownership, active status, text extraction presence, course/semester non-archived status,
 * duplicate request deduplication, and transactional quota reservation.
 */
export async function requestSummaryGeneration(
  userId: string,
  materialId: string,
  isRegeneration = false
): Promise<{ summary: MaterialSummary; jobId: string }> {
  // 1. Fetch material with course and semester relations
  const material = await prisma.material.findFirst({
    where: {
      id: materialId,
      deletedAt: null,
    },
    include: {
      course: {
        include: {
          semester: true,
        },
      },
    },
  });

  if (!material) {
    throw createError(404, 'NOT_FOUND', 'Materi tidak ditemukan');
  }

  // 2. Ownership check
  if (material.userId !== userId) {
    throw createError(403, 'FORBIDDEN', 'Anda tidak memiliki akses ke materi ini');
  }

  // 3. Verify course and semester are not archived
  if (material.course.archivedAt) {
    throw createError(
      400,
      'COURSE_ARCHIVED',
      'Mata kuliah telah diarsipkan. Ringkasan AI tidak dapat dibuat untuk materi pada mata kuliah yang diarsipkan.'
    );
  }

  if (material.course.semester.archivedAt) {
    throw createError(
      400,
      'SEMESTER_ARCHIVED',
      'Semester telah diarsipkan. Ringkasan AI tidak dapat dibuat untuk materi pada semester yang diarsipkan.'
    );
  }

  // 4. Verify material status is READY
  if (material.status !== 'READY') {
    if (material.status === 'FAILED') {
      throw createError(
        400,
        'MATERIAL_PROCESSING_FAILED',
        'Materi gagal diproses. Ringkasan AI tidak dapat dibuat.'
      );
    }
    throw createError(
      400,
      'MATERIAL_NOT_READY',
      'Materi masih dalam proses ekstraksi teks. Harap tunggu hingga status materi READY.'
    );
  }

  // 5. Verify AI provider is configured upfront
  if (env.AI_PROVIDER === 'none') {
    throw createError(
      503,
      'AI_PROVIDER_UNAVAILABLE',
      'Layanan ringkasan AI dinonaktifkan oleh administrator.'
    );
  }
  if (env.AI_PROVIDER === 'gemini' && !env.GEMINI_API_KEY) {
    throw createError(
      503,
      'AI_PROVIDER_UNCONFIGURED',
      'Layanan Gemini AI belum dikonfigurasi (GEMINI_API_KEY belum diatur).'
    );
  }

  // 6. Verify total size limits and extracted text adequacy
  if (material.pageCount && material.pageCount > 100) {
    throw createError(
      400,
      'DOCUMENT_TOO_LARGE',
      `Dokumen terlalu panjang untuk diringkas (maksimal 100 halaman, terdeteksi: ${material.pageCount} halaman). Silakan bagi dokumen menjadi berkas yang lebih kecil.`
    );
  }

  const pageCount = await prisma.materialPage.count({
    where: { materialId },
  });
  if (pageCount === 0) {
    throw createError(
      400,
      'INSUFFICIENT_TEXT',
      'Materi tidak memiliki teks hasil ekstraksi untuk diringkas.'
    );
  }

  const pages = await prisma.materialPage.findMany({
    where: { materialId },
    select: { pageNumber: true, characterCount: true },
    orderBy: { pageNumber: 'asc' },
  });
  const totalChars = pages.reduce((acc, p) => acc + p.characterCount, 0);
  if (totalChars < AI_SUMMARY_LIMITS.minCharacters) {
    throw createError(
      400,
      'INSUFFICIENT_TEXT',
      'Teks hasil ekstraksi materi terlalu pendek untuk dibuatkan ringkasan AI.'
    );
  }

  // Enforce total document length limit (max 100 pages, max 120,000 characters processable across max 3 chunks)
  if (pageCount > AI_SUMMARY_LIMITS.maxPages || totalChars > AI_SUMMARY_LIMITS.maxTotalCharacters) {
    throw createError(
      400,
      'DOCUMENT_TOO_LARGE',
      `Dokumen terlalu panjang untuk diringkas (maksimal ${AI_SUMMARY_LIMITS.maxPages} halaman atau ${AI_SUMMARY_LIMITS.maxTotalCharacters.toLocaleString('id-ID')} karakter, terdeteksi: ${pageCount} halaman, ${totalChars.toLocaleString('id-ID')} karakter). Silakan bagi dokumen menjadi berkas yang lebih kecil.`
    );
  }

  // Enforce single-page limit against chunk capacity (each page must fit in a 40,000 char chunk)
  const oversizedPage = pages.find((p) => p.characterCount > AI_SUMMARY_LIMITS.maxChunkCharacters);
  if (oversizedPage) {
    throw createError(
      400,
      'DOCUMENT_TOO_LARGE',
      `Halaman ${oversizedPage.pageNumber} memiliki ${oversizedPage.characterCount.toLocaleString('id-ID')} karakter, melampaui batas maksimal ${AI_SUMMARY_LIMITS.maxChunkCharacters.toLocaleString('id-ID')} karakter per halaman/bagian.`
    );
  }

  // Enforce total chunks capacity (max 3 chunks)
  let chunkCount = 0;
  let currentChunkChars = 0;
  for (const p of pages) {
    if (currentChunkChars + p.characterCount > AI_SUMMARY_LIMITS.maxChunkCharacters && currentChunkChars > 0) {
      chunkCount++;
      currentChunkChars = p.characterCount;
    } else {
      currentChunkChars += p.characterCount;
    }
  }
  if (currentChunkChars > 0) chunkCount++;
  if (chunkCount > AI_SUMMARY_LIMITS.maxChunks) {
    throw createError(
      400,
      'DOCUMENT_TOO_LARGE',
      `Dokumen membutuhkan lebih dari ${AI_SUMMARY_LIMITS.maxChunks} bagian pemrosesan (terdeteksi: ${chunkCount} bagian). Silakan bagi dokumen menjadi berkas yang lebih kecil.`
    );
  }

  // 7. Atomic transaction: serialize per-material requests, check & reserve quota, job, summary upsert, outbox event
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Lock the material row exclusively to serialize concurrent requests for this material
      await tx.$executeRaw`SELECT id FROM materials WHERE id = ${materialId} FOR UPDATE`;

      // Check current summary state under lock
      const currentSummary = await tx.materialSummary.findUnique({
        where: { materialId },
      });

      // Deduplicate double-clicks / concurrent requests:
      if (
        currentSummary &&
        (currentSummary.status === 'QUEUED' || currentSummary.status === 'PROCESSING')
      ) {
        return {
          summary: toSummaryResponse(currentSummary),
          jobId: currentSummary.activeJobId || currentSummary.id,
        };
      }

      // If already READY and not regenerate: return existing
      if (currentSummary && currentSummary.status === 'READY' && !isRegeneration) {
        return {
          summary: toSummaryResponse(currentSummary),
          jobId: currentSummary.activeJobId || currentSummary.id,
        };
      }

      // Atomically check and reserve user AI quota under user lock
      await checkAndReserveAiQuota(tx, userId);

      const summaryId = currentSummary?.id ?? crypto.randomUUID();

      const job = await tx.processingJob.create({
        data: {
          userId,
          materialId,
          type: 'AI_SUMMARY_GENERATION',
          status: 'PENDING',
          attempts: 0,
          maxAttempts: 3,
          payload: {
            summaryId,
            materialId,
            userId,
            isRegeneration,
          },
        },
      });

      // Preserve previous ready summary contents during regeneration
      const updatedSummary = await tx.materialSummary.upsert({
        where: { materialId },
        create: {
          id: summaryId,
          userId,
          materialId,
          status: 'QUEUED',
          activeJobId: job.id,
          provider: env.AI_PROVIDER || 'gemini',
          model: env.GEMINI_MODEL || 'gemini-2.5-flash',
          sourcePageCount: pageCount,
          sourceCharacterCount: totalChars,
        },
        update: {
          status: 'QUEUED',
          activeJobId: job.id,
          errorCode: null,
          errorMessage: null,
        },
      });

      await tx.outboxEvent.create({
        data: {
          eventType: 'AI_SUMMARY_REQUESTED',
          aggregateId: job.id,
          payload: {
            jobId: job.id,
            summaryId: updatedSummary.id,
            materialId,
            userId,
            isRegeneration,
          },
        },
      });

      return {
        summary: toSummaryResponse(updatedSummary),
        jobId: job.id,
      };
    });

    // Trigger immediate outbox dispatch (non-blocking)
    dispatchOutboxEvents().catch((err) => {
      console.error('[SummaryService] Failed immediate outbox dispatch:', err);
    });

    return result;
  } catch (err: any) {
    if (err instanceof AiQuotaError) {
      throw createError(429, err.code, err.message);
    }
    throw err;
  }
}

/**
 * Retrieves the current summary (if any) and AI quota status for a material.
 */
export async function getSummaryByMaterialId(
  userId: string,
  materialId: string
): Promise<{ summary: MaterialSummary | null; quota: AiQuotaStatus }> {
  const material = await prisma.material.findFirst({
    where: {
      id: materialId,
      deletedAt: null,
    },
  });

  if (!material) {
    throw createError(404, 'NOT_FOUND', 'Materi tidak ditemukan');
  }

  if (material.userId !== userId) {
    throw createError(403, 'FORBIDDEN', 'Anda tidak memiliki akses ke materi ini');
  }

  const rawSummary = await prisma.materialSummary.findUnique({
    where: { materialId },
  });

  const quotaRaw = await getUserAiQuotaStatus(userId);
  const quota = formatAiQuotaStatus(quotaRaw);

  return {
    summary: rawSummary ? toSummaryResponse(rawSummary) : null,
    quota,
  };
}

/**
 * Retrieves current AI quota status for the authenticated user.
 */
export async function getUserQuota(userId: string): Promise<AiQuotaStatus> {
  const quotaRaw = await getUserAiQuotaStatus(userId);
  return formatAiQuotaStatus(quotaRaw);
}
