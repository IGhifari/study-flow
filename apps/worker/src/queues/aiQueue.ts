import { Job } from 'bullmq';
import { prisma } from '@studyflow/database';
import { AI_SUMMARY_LIMITS } from '@studyflow/shared';
import {
  getAiProviderAdapter,
  AiProviderError,
} from '../services/aiProvider.js';

export interface AiSummaryJobData {
  jobId: string;
  summaryId: string;
  materialId: string;
  userId: string;
  isRegeneration?: boolean;
}

export interface AiFlashcardJobData {
  jobId: string;
  setId: string;
  materialId: string;
  userId: string;
  targetCount: number;
}

export interface AiQuizJobData {
  jobId: string;
  quizId: string;
  materialId: string;
  userId: string;
  targetCount: number;
}

export interface AiSummaryJobResult {
  jobId: string;
  materialId: string;
  status: 'READY' | 'FAILED';
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
  error?: string;
  errorCode?: string;
}

export interface AiLearningJobResult {
  jobId: string;
  materialId: string;
  status: 'READY' | 'FAILED';
  itemCount?: number;
  durationMs?: number;
  error?: string;
  errorCode?: string;
}

export interface FinishAiJobParams {
  jobId: string;
  userId: string;
  status: 'COMPLETED' | 'FAILED';
  errorCode?: string | null;
  errorMessage?: string | null;
  payload?: Record<string, unknown>;
  onSuccessTx?: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<void>;
}

/**
 * Atomically marks a processing job as COMPLETED or FAILED and releases the active AI job slot
 * IF AND ONLY IF the job was currently in PENDING or PROCESSING status.
 *
 * If the job was ALREADY COMPLETED or FAILED (e.g. duplicate BullMQ execution or replayed message),
 * exactly 0 rows are updated and the slot is NOT decremented, guaranteeing:
 * 1. Slot is released exactly once per job.
 * 2. Duplicate executions do NOT steal or decrement the active job slot of another concurrent job.
 * 3. Crash / restarts that retry will only release the slot once on final completion/failure.
 */
export async function finishAiJobAtomically(
  params: FinishAiJobParams
): Promise<{ wasSlotReleased: boolean }> {
  const { jobId, userId, status, errorCode, errorMessage, payload, onSuccessTx } = params;
  const now = new Date();

  return await prisma.$transaction(async (tx) => {
    // 1. Atomically transition job status from PENDING/PROCESSING to COMPLETED/FAILED
    const rowsUpdated = await tx.$executeRaw`
      UPDATE processing_jobs
      SET status = ${status}::"ProcessingJobStatus",
          error_code = ${errorCode ?? null},
          error_message = ${errorMessage ?? null},
          completed_at = ${status === 'COMPLETED' ? now : null},
          failed_at = ${status === 'FAILED' ? now : null},
          payload = COALESCE(${payload ? JSON.stringify(payload) : null}::jsonb, payload),
          updated_at = ${now}
      WHERE id = ${jobId} AND status IN ('PENDING', 'PROCESSING')
    `;

    const wasSlotReleased = rowsUpdated === 1;

    if (wasSlotReleased) {
      // 2. Decrement user's activeJobsCount exactly once
      await tx.$executeRaw`
        UPDATE ai_usages
        SET active_jobs_count = GREATEST(0, active_jobs_count - 1),
            updated_at = ${now}
        WHERE user_id = ${userId} AND active_jobs_count > 0
      `;

      if (onSuccessTx) {
        await onSuccessTx(tx);
      }
    } else {
      console.warn(
        JSON.stringify({
          level: 'warn',
          timestamp: now.toISOString(),
          message: `[Worker] Job ${jobId} was already finalized. Duplicate execution ignored; active job slot was NOT decremented.`,
          targetStatus: status,
        })
      );
    }

    return { wasSlotReleased };
  });
}

/**
 * Decrements the user's active concurrent AI jobs count safely (standalone fallback).
 */
export async function decrementActiveJobsCount(userId: string): Promise<void> {
  try {
    await prisma.$executeRaw`
      UPDATE ai_usages
      SET active_jobs_count = GREATEST(0, active_jobs_count - 1),
          updated_at = NOW()
      WHERE user_id = ${userId} AND active_jobs_count > 0
    `;
  } catch (err) {
    console.error(`[Worker] Failed to decrement active jobs for user ${userId}:`, err);
  }
}

export async function processAiSummaryJob(
  job: Job<AiSummaryJobData, AiSummaryJobResult>
): Promise<AiSummaryJobResult> {
  const { jobId, summaryId, materialId, userId, isRegeneration } = job.data;
  const startedAt = new Date();

  console.log(
    JSON.stringify({
      level: 'info',
      timestamp: startedAt.toISOString(),
      message: `[Worker] Processing AI Summary generation for job ${jobId}, material ${materialId}`,
      attempt: job.attemptsMade + 1,
      isRegeneration: Boolean(isRegeneration),
    })
  );

  // 0. Check if job has already reached terminal status (duplicate execution detection)
  const jobRecord = await prisma.processingJob.findUnique({
    where: { id: jobId },
    select: { status: true },
  });

  if (jobRecord && (jobRecord.status === 'COMPLETED' || jobRecord.status === 'FAILED')) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        timestamp: startedAt.toISOString(),
        message: `[Worker] Job ${jobId} is already in terminal state ${jobRecord.status}. Aborting duplicate execution without modifying slots.`,
      })
    );
    return {
      jobId,
      materialId,
      status: jobRecord.status === 'COMPLETED' ? 'READY' : 'FAILED',
    };
  }

  // 1. Verify Material exists, belongs to user, and is not soft-deleted
  const material = await prisma.material.findFirst({
    where: { id: materialId, userId },
    include: {
      pages: {
        orderBy: { pageNumber: 'asc' },
      },
    },
  });

  if (!material || material.deletedAt !== null) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        timestamp: new Date().toISOString(),
        message: `[Worker] Material ${materialId} was deleted or not found. Aborting AI summary.`,
      })
    );

    await finishAiJobAtomically({
      jobId,
      userId,
      status: 'FAILED',
      errorCode: 'MATERIAL_DELETED',
      errorMessage: 'Materi telah dihapus sebelum proses generasi ringkasan selesai.',
    });

    return {
      jobId,
      materialId,
      status: 'FAILED',
      errorCode: 'MATERIAL_DELETED',
      error: 'Materi telah dihapus',
    };
  }

  if (material.status !== 'READY') {
    console.warn(
      JSON.stringify({
        level: 'warn',
        timestamp: new Date().toISOString(),
        message: `[Worker] Material ${materialId} status is ${material.status}, not READY.`,
      })
    );

    await finishAiJobAtomically({
      jobId,
      userId,
      status: 'FAILED',
      errorCode: 'MATERIAL_NOT_READY',
      errorMessage: 'Materi belum selesai diekstrak sehingga ringkasan tidak dapat dibuat.',
    });

    return {
      jobId,
      materialId,
      status: 'FAILED',
      errorCode: 'MATERIAL_NOT_READY',
      error: 'Materi belum berstatus READY',
    };
  }

  // 2. Validate total size bounds: maximum 100 pages
  if (material.pageCount && material.pageCount > AI_SUMMARY_LIMITS.maxPages) {
    const errorMsg = `Dokumen melampaui batas maksimal ${AI_SUMMARY_LIMITS.maxPages} halaman untuk pembuatan ringkasan AI.`;
    console.warn(
      JSON.stringify({
        level: 'warn',
        timestamp: new Date().toISOString(),
        message: `[Worker] Material ${materialId} exceeds ${AI_SUMMARY_LIMITS.maxPages} pages limit (${material.pageCount} pages).`,
      })
    );

    await finishAiJobAtomically({
      jobId,
      userId,
      status: 'FAILED',
      errorCode: 'DOCUMENT_TOO_LARGE',
      errorMessage: errorMsg,
      onSuccessTx: async (tx) => {
        await tx.materialSummary.update({
          where: { id: summaryId },
          data: {
            status: 'FAILED',
            errorCode: 'DOCUMENT_TOO_LARGE',
            errorMessage: errorMsg,
            activeJobId: null,
          },
        });
      },
    });

    return {
      jobId,
      materialId,
      status: 'FAILED',
      errorCode: 'DOCUMENT_TOO_LARGE',
      error: errorMsg,
    };
  }

  // 3. Validate extracted text availability
  const pagesWithText = material.pages.filter(
    (p) => p.extractedText && p.extractedText.trim().length > 0
  );
  const totalCharacters = pagesWithText.reduce(
    (acc, p) => acc + (p.characterCount || p.extractedText.length),
    0
  );

  if (pagesWithText.length === 0 || totalCharacters < AI_SUMMARY_LIMITS.minCharacters) {
    const errorMsg = 'Teks dokumen tidak memadai untuk membuat ringkasan AI (kurang dari 50 karakter).';
    console.warn(
      JSON.stringify({
        level: 'warn',
        timestamp: new Date().toISOString(),
        message: `[Worker] Material ${materialId} has insufficient extracted text (${totalCharacters} chars).`,
      })
    );

    await finishAiJobAtomically({
      jobId,
      userId,
      status: 'FAILED',
      errorCode: 'INSUFFICIENT_TEXT',
      errorMessage: errorMsg,
      onSuccessTx: async (tx) => {
        await tx.materialSummary.update({
          where: { id: summaryId },
          data: {
            status: 'FAILED',
            errorCode: 'INSUFFICIENT_TEXT',
            errorMessage: errorMsg,
            activeJobId: null,
          },
        });
      },
    });

    return {
      jobId,
      materialId,
      status: 'FAILED',
      errorCode: 'INSUFFICIENT_TEXT',
      error: errorMsg,
    };
  }

  // 4. Validate single page bounds (each page must fit in a 40,000 char chunk without truncation)
  const oversizedPage = pagesWithText.find(
    (p) => (p.characterCount || p.extractedText.length) > AI_SUMMARY_LIMITS.maxChunkCharacters
  );
  if (oversizedPage) {
    const pageChars = oversizedPage.characterCount || oversizedPage.extractedText.length;
    const errorMsg = `Halaman ${oversizedPage.pageNumber} memiliki ${pageChars.toLocaleString('id-ID')} karakter, melampaui batas maksimal ${AI_SUMMARY_LIMITS.maxChunkCharacters.toLocaleString('id-ID')} karakter per halaman/bagian.`;
    console.warn(
      JSON.stringify({
        level: 'warn',
        timestamp: new Date().toISOString(),
        message: `[Worker] Material ${materialId} page ${oversizedPage.pageNumber} exceeds single chunk limit (${pageChars} chars).`,
      })
    );

    await finishAiJobAtomically({
      jobId,
      userId,
      status: 'FAILED',
      errorCode: 'DOCUMENT_TOO_LARGE',
      errorMessage: errorMsg,
      onSuccessTx: async (tx) => {
        await tx.materialSummary.update({
          where: { id: summaryId },
          data: {
            status: 'FAILED',
            errorCode: 'DOCUMENT_TOO_LARGE',
            errorMessage: errorMsg,
            activeJobId: null,
          },
        });
      },
    });

    return {
      jobId,
      materialId,
      status: 'FAILED',
      errorCode: 'DOCUMENT_TOO_LARGE',
      error: errorMsg,
    };
  }

  // 5. Validate total character bounds: maximum 120,000 characters processable across max 3 chunks
  if (totalCharacters > AI_SUMMARY_LIMITS.maxTotalCharacters) {
    const errorMsg = `Dokumen melampaui batas maksimal ${AI_SUMMARY_LIMITS.maxTotalCharacters.toLocaleString('id-ID')} karakter untuk pembuatan ringkasan AI (terdeteksi: ${totalCharacters.toLocaleString('id-ID')} karakter).`;
    console.warn(
      JSON.stringify({
        level: 'warn',
        timestamp: new Date().toISOString(),
        message: `[Worker] Material ${materialId} exceeds maximum characters limit (${totalCharacters} chars).`,
      })
    );

    await finishAiJobAtomically({
      jobId,
      userId,
      status: 'FAILED',
      errorCode: 'DOCUMENT_TOO_LARGE',
      errorMessage: errorMsg,
      onSuccessTx: async (tx) => {
        await tx.materialSummary.update({
          where: { id: summaryId },
          data: {
            status: 'FAILED',
            errorCode: 'DOCUMENT_TOO_LARGE',
            errorMessage: errorMsg,
            activeJobId: null,
          },
        });
      },
    });

    return {
      jobId,
      materialId,
      status: 'FAILED',
      errorCode: 'DOCUMENT_TOO_LARGE',
      error: errorMsg,
    };
  }

  // 6. Transition status to PROCESSING atomically
  await prisma.$executeRaw`
    UPDATE processing_jobs
    SET status = 'PROCESSING'::"ProcessingJobStatus",
        started_at = COALESCE(started_at, ${startedAt}),
        attempts = ${(job.attemptsMade ?? 0) + 1},
        updated_at = ${startedAt}
    WHERE id = ${jobId} AND status = 'PENDING'
  `;

  await prisma.materialSummary.updateMany({
    where: { id: summaryId },
    data: {
      status: 'PROCESSING',
      activeJobId: jobId,
    },
  });

  const inputPages: { pageNumber: number; text: string }[] = pagesWithText.map((p) => ({
    pageNumber: p.pageNumber,
    text: p.extractedText,
  }));

  const emptyPagesCount = material.pageCount
    ? material.pageCount - pagesWithText.length
    : 0;

  let limitationsNote: string | null = null;
  if (emptyPagesCount > 0) {
    limitationsNote = `Terdapat ${emptyPagesCount} halaman tanpa teks terdeteksi (gambar/diagram) yang tidak dimasukkan dalam analisis teks.`;
  }

  try {
    // 7. Call AI Provider Adapter with timeout and jobId for per-call rate & limit enforcement
    const aiAdapter = getAiProviderAdapter();
    const aiResult = await aiAdapter.generateSummary(
      {
        materialTitle: material.title,
        pages: inputPages,
        totalPages: material.pageCount || material.pages.length,
      },
      { timeoutMs: 45000, jobId }
    );

    // 8. Check again if material was deleted while provider was generating
    const freshCheck = await prisma.material.findFirst({
      where: { id: materialId, userId },
      select: { deletedAt: true },
    });

    if (!freshCheck || freshCheck.deletedAt !== null) {
      console.warn(
        JSON.stringify({
          level: 'warn',
          timestamp: new Date().toISOString(),
          message: `[Worker] Material ${materialId} was deleted during AI generation. Discarding output.`,
        })
      );

      await finishAiJobAtomically({
        jobId,
        userId,
        status: 'FAILED',
        errorCode: 'MATERIAL_DELETED',
        errorMessage: 'Materi telah dihapus selama proses pembuatan ringkasan AI.',
      });

      return {
        jobId,
        materialId,
        status: 'FAILED',
        errorCode: 'MATERIAL_DELETED',
        error: 'Materi telah dihapus selama proses pembuatan ringkasan',
      };
    }

    // 9. Atomically save successful summary, complete job, and release active job slot
    await finishAiJobAtomically({
      jobId,
      userId,
      status: 'COMPLETED',
      payload: {
        inputTokens: aiResult.inputTokens,
        outputTokens: aiResult.outputTokens,
        durationMs: aiResult.durationMs,
      },
      onSuccessTx: async (tx) => {
        await tx.materialSummary.update({
          where: { id: summaryId },
          data: {
            status: 'READY',
            title: aiResult.title,
            overview: aiResult.overview,
            keyConcepts: aiResult.keyConcepts as any,
            sections: aiResult.sections as any,
            keyTerms: aiResult.keyTerms as any,
            limitations: limitationsNote,
            sourcePageCount: material.pageCount || material.pages.length,
            sourceCharacterCount: totalCharacters,
            inputTokens: aiResult.inputTokens ?? null,
            outputTokens: aiResult.outputTokens ?? null,
            durationMs: aiResult.durationMs,
            errorCode: null,
            errorMessage: null,
            activeJobId: null,
          },
        });
      },
    });

    console.log(
      JSON.stringify({
        level: 'info',
        timestamp: new Date().toISOString(),
        message: `[Worker] AI Summary ${summaryId} generated successfully in ${aiResult.durationMs}ms`,
        inputTokens: aiResult.inputTokens,
        outputTokens: aiResult.outputTokens,
      })
    );

    return {
      jobId,
      materialId,
      status: 'READY',
      inputTokens: aiResult.inputTokens,
      outputTokens: aiResult.outputTokens,
      durationMs: aiResult.durationMs,
    };
  } catch (err: any) {
    const isAiError = err instanceof AiProviderError;
    const errorCode = isAiError ? err.code : 'AI_GENERATION_FAILED';
    const errorMessage = err instanceof Error ? err.message : String(err);
    const isRetryable = isAiError ? err.isRetryable : false;

    console.error(
      JSON.stringify({
        level: 'error',
        timestamp: new Date().toISOString(),
        message: `[Worker] AI Summary generation failed for job ${jobId}: ${errorMessage}`,
        errorCode,
        isRetryable,
      })
    );

    const willRetry = isRetryable && ((job.attemptsMade ?? 0) + 1 < (job.opts?.attempts || 3));

    if (willRetry) {
      // Re-throw to trigger BullMQ exponential backoff without releasing slot
      throw err;
    }

    // Terminal failure: update summary & job, release active job slot exactly once
    const existingSummary = await prisma.materialSummary.findUnique({
      where: { id: summaryId },
    });

    const hasPreviousSuccessfulSummary = Boolean(existingSummary?.overview);

    await finishAiJobAtomically({
      jobId,
      userId,
      status: 'FAILED',
      errorCode,
      errorMessage,
      onSuccessTx: async (tx) => {
        if (hasPreviousSuccessfulSummary) {
          // Preserve previous successful summary, revert status to READY
          await tx.materialSummary.update({
            where: { id: summaryId },
            data: {
              status: 'READY',
              activeJobId: null,
              errorMessage: `Pembuatan ulang gagal: ${errorMessage}`,
            },
          });
        } else {
          // First generation failed
          await tx.materialSummary.update({
            where: { id: summaryId },
            data: {
              status: 'FAILED',
              errorCode,
              errorMessage,
              activeJobId: null,
            },
          });
        }
      },
    });

    return {
      jobId,
      materialId,
      status: 'FAILED',
      errorCode,
      error: errorMessage,
    };
  }
}

export async function processAiFlashcardJob(
  job: Job<AiFlashcardJobData, AiLearningJobResult>
): Promise<AiLearningJobResult> {
  const { jobId, setId, materialId, userId, targetCount } = job.data;
  const startedAt = new Date();

  console.log(
    JSON.stringify({
      level: 'info',
      timestamp: startedAt.toISOString(),
      message: `[Worker] Processing AI Flashcard generation for job ${jobId}, material ${materialId}, targetCount ${targetCount}`,
      attempt: (job.attemptsMade ?? 0) + 1,
    })
  );

  // 0. Check if job has already reached terminal status
  const jobRecord = await prisma.processingJob.findUnique({
    where: { id: jobId },
    select: { status: true },
  });

  if (jobRecord && (jobRecord.status === 'COMPLETED' || jobRecord.status === 'FAILED')) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        timestamp: startedAt.toISOString(),
        message: `[Worker] Job ${jobId} is already in terminal state ${jobRecord.status}. Aborting duplicate execution.`,
      })
    );
    return {
      jobId,
      materialId,
      status: jobRecord.status === 'COMPLETED' ? 'READY' : 'FAILED',
    };
  }

  // 1. Verify Material exists, belongs to user, and is not deleted
  const material = await prisma.material.findFirst({
    where: { id: materialId, userId },
    include: {
      pages: { orderBy: { pageNumber: 'asc' } },
    },
  });

  if (!material || material.deletedAt !== null) {
    await finishAiJobAtomically({
      jobId,
      userId,
      status: 'FAILED',
      errorCode: 'MATERIAL_DELETED',
      errorMessage: 'Materi telah dihapus sebelum proses generasi flashcard selesai.',
    });
    return {
      jobId,
      materialId,
      status: 'FAILED',
      errorCode: 'MATERIAL_DELETED',
      error: 'Materi telah dihapus',
    };
  }

  if (material.status !== 'READY') {
    await finishAiJobAtomically({
      jobId,
      userId,
      status: 'FAILED',
      errorCode: 'MATERIAL_NOT_READY',
      errorMessage: 'Materi belum selesai diekstrak sehingga flashcard tidak dapat dibuat.',
    });
    return {
      jobId,
      materialId,
      status: 'FAILED',
      errorCode: 'MATERIAL_NOT_READY',
      error: 'Materi belum berstatus READY',
    };
  }

  // 2. Validate extracted text availability
  const pagesWithText = material.pages.filter(
    (p) => p.extractedText && p.extractedText.trim().length > 0
  );
  const totalCharacters = pagesWithText.reduce(
    (acc, p) => acc + (p.characterCount || p.extractedText.length),
    0
  );

  if (pagesWithText.length === 0 || totalCharacters < 50) {
    const errorMsg = 'Teks dokumen tidak memadai untuk membuat kartu flashcard (kurang dari 50 karakter).';
    await finishAiJobAtomically({
      jobId,
      userId,
      status: 'FAILED',
      errorCode: 'INSUFFICIENT_TEXT',
      errorMessage: errorMsg,
      onSuccessTx: async (tx) => {
        await tx.flashcardSet.update({
          where: { id: setId },
          data: { status: 'FAILED', errorCode: 'INSUFFICIENT_TEXT', errorMessage: errorMsg, activeJobId: null },
        });
      },
    });
    return { jobId, materialId, status: 'FAILED', errorCode: 'INSUFFICIENT_TEXT', error: errorMsg };
  }

  // 3. Transition status to PROCESSING atomically
  await prisma.$executeRaw`
    UPDATE processing_jobs
    SET status = 'PROCESSING'::"ProcessingJobStatus",
        started_at = COALESCE(started_at, ${startedAt}),
        attempts = ${(job.attemptsMade ?? 0) + 1},
        updated_at = ${startedAt}
    WHERE id = ${jobId} AND status = 'PENDING'
  `;

  await prisma.flashcardSet.updateMany({
    where: { id: setId },
    data: { status: 'PROCESSING', activeJobId: jobId },
  });

  const inputPages = pagesWithText.map((p) => ({
    pageNumber: p.pageNumber,
    text: p.extractedText,
  }));

  try {
    const aiAdapter = getAiProviderAdapter();
    const aiResult = await aiAdapter.generateFlashcards(
      {
        materialTitle: material.title,
        pages: inputPages,
        totalPages: material.pageCount || material.pages.length,
        targetCount,
      },
      { timeoutMs: 45000, jobId }
    );

    // Re-check if material deleted while generating
    const freshCheck = await prisma.material.findFirst({
      where: { id: materialId, userId },
      select: { deletedAt: true },
    });
    if (!freshCheck || freshCheck.deletedAt !== null) {
      await finishAiJobAtomically({
        jobId,
        userId,
        status: 'FAILED',
        errorCode: 'MATERIAL_DELETED',
        errorMessage: 'Materi telah dihapus selama proses pembuatan flashcard.',
      });
      return { jobId, materialId, status: 'FAILED', errorCode: 'MATERIAL_DELETED', error: 'Materi telah dihapus' };
    }

    // Atomically save flashcards and mark set & job READY
    await finishAiJobAtomically({
      jobId,
      userId,
      status: 'COMPLETED',
      payload: {
        cardCount: aiResult.cards.length,
        durationMs: aiResult.durationMs,
      },
      onSuccessTx: async (tx) => {
        // Delete previous cards in this set if regenerating
        await tx.flashcard.deleteMany({ where: { setId } });

        // Insert new cards
        await tx.flashcard.createMany({
          data: aiResult.cards.map((c, idx) => ({
            setId,
            front: c.front,
            back: c.back,
            pageReferences: c.pageReferences,
            orderIndex: idx,
            masteryStatus: 'UNRATED',
          })),
        });

        await tx.flashcardSet.update({
          where: { id: setId },
          data: {
            title: aiResult.title,
            cardCount: aiResult.cards.length,
            status: 'READY',
            errorCode: null,
            errorMessage: null,
            activeJobId: null,
          },
        });
      },
    });

    return {
      jobId,
      materialId,
      status: 'READY',
      itemCount: aiResult.cards.length,
      durationMs: aiResult.durationMs,
    };
  } catch (err: any) {
    const isAiError = err instanceof AiProviderError;
    const errorCode = isAiError ? err.code : 'AI_GENERATION_FAILED';
    const errorMessage = err instanceof Error ? err.message : String(err);
    const isRetryable = isAiError ? err.isRetryable : false;

    console.error(
      JSON.stringify({
        level: 'error',
        timestamp: new Date().toISOString(),
        message: `[Worker] AI Flashcard generation failed for job ${jobId}: ${errorMessage}`,
        errorCode,
        isRetryable,
      })
    );

    const willRetry = isRetryable && ((job.attemptsMade ?? 0) + 1 < (job.opts?.attempts || 3));
    if (willRetry) {
      throw err;
    }

    await finishAiJobAtomically({
      jobId,
      userId,
      status: 'FAILED',
      errorCode,
      errorMessage,
      onSuccessTx: async (tx) => {
        await tx.flashcardSet.update({
          where: { id: setId },
          data: {
            status: 'FAILED',
            errorCode,
            errorMessage,
            activeJobId: null,
          },
        });
      },
    });

    return {
      jobId,
      materialId,
      status: 'FAILED',
      errorCode,
      error: errorMessage,
    };
  }
}

export async function processAiQuizJob(
  job: Job<AiQuizJobData, AiLearningJobResult>
): Promise<AiLearningJobResult> {
  const { jobId, quizId, materialId, userId, targetCount } = job.data;
  const startedAt = new Date();

  console.log(
    JSON.stringify({
      level: 'info',
      timestamp: startedAt.toISOString(),
      message: `[Worker] Processing AI Quiz generation for job ${jobId}, material ${materialId}, targetCount ${targetCount}`,
      attempt: (job.attemptsMade ?? 0) + 1,
    })
  );

  // 0. Check if job has already reached terminal status
  const jobRecord = await prisma.processingJob.findUnique({
    where: { id: jobId },
    select: { status: true },
  });

  if (jobRecord && (jobRecord.status === 'COMPLETED' || jobRecord.status === 'FAILED')) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        timestamp: startedAt.toISOString(),
        message: `[Worker] Job ${jobId} is already in terminal state ${jobRecord.status}. Aborting duplicate execution.`,
      })
    );
    return {
      jobId,
      materialId,
      status: jobRecord.status === 'COMPLETED' ? 'READY' : 'FAILED',
    };
  }

  // 1. Verify Material exists, belongs to user, and is not deleted
  const material = await prisma.material.findFirst({
    where: { id: materialId, userId },
    include: {
      pages: { orderBy: { pageNumber: 'asc' } },
    },
  });

  if (!material || material.deletedAt !== null) {
    await finishAiJobAtomically({
      jobId,
      userId,
      status: 'FAILED',
      errorCode: 'MATERIAL_DELETED',
      errorMessage: 'Materi telah dihapus sebelum proses generasi kuis selesai.',
    });
    return {
      jobId,
      materialId,
      status: 'FAILED',
      errorCode: 'MATERIAL_DELETED',
      error: 'Materi telah dihapus',
    };
  }

  if (material.status !== 'READY') {
    await finishAiJobAtomically({
      jobId,
      userId,
      status: 'FAILED',
      errorCode: 'MATERIAL_NOT_READY',
      errorMessage: 'Materi belum selesai diekstrak sehingga kuis tidak dapat dibuat.',
    });
    return {
      jobId,
      materialId,
      status: 'FAILED',
      errorCode: 'MATERIAL_NOT_READY',
      error: 'Materi belum berstatus READY',
    };
  }

  // 2. Validate extracted text availability
  const pagesWithText = material.pages.filter(
    (p) => p.extractedText && p.extractedText.trim().length > 0
  );
  const totalCharacters = pagesWithText.reduce(
    (acc, p) => acc + (p.characterCount || p.extractedText.length),
    0
  );

  if (pagesWithText.length === 0 || totalCharacters < 50) {
    const errorMsg = 'Teks dokumen tidak memadai untuk membuat kuis (kurang dari 50 karakter).';
    await finishAiJobAtomically({
      jobId,
      userId,
      status: 'FAILED',
      errorCode: 'INSUFFICIENT_TEXT',
      errorMessage: errorMsg,
      onSuccessTx: async (tx) => {
        await tx.quiz.update({
          where: { id: quizId },
          data: { status: 'FAILED', errorCode: 'INSUFFICIENT_TEXT', errorMessage: errorMsg, activeJobId: null },
        });
      },
    });
    return { jobId, materialId, status: 'FAILED', errorCode: 'INSUFFICIENT_TEXT', error: errorMsg };
  }

  // 3. Transition status to PROCESSING atomically
  await prisma.$executeRaw`
    UPDATE processing_jobs
    SET status = 'PROCESSING'::"ProcessingJobStatus",
        started_at = COALESCE(started_at, ${startedAt}),
        attempts = ${(job.attemptsMade ?? 0) + 1},
        updated_at = ${startedAt}
    WHERE id = ${jobId} AND status = 'PENDING'
  `;

  await prisma.quiz.updateMany({
    where: { id: quizId },
    data: { status: 'PROCESSING', activeJobId: jobId },
  });

  const inputPages = pagesWithText.map((p) => ({
    pageNumber: p.pageNumber,
    text: p.extractedText,
  }));

  try {
    const aiAdapter = getAiProviderAdapter();
    const aiResult = await aiAdapter.generateQuiz(
      {
        materialTitle: material.title,
        pages: inputPages,
        totalPages: material.pageCount || material.pages.length,
        targetCount,
      },
      { timeoutMs: 45000, jobId }
    );

    // Re-check if material deleted while generating
    const freshCheck = await prisma.material.findFirst({
      where: { id: materialId, userId },
      select: { deletedAt: true },
    });
    if (!freshCheck || freshCheck.deletedAt !== null) {
      await finishAiJobAtomically({
        jobId,
        userId,
        status: 'FAILED',
        errorCode: 'MATERIAL_DELETED',
        errorMessage: 'Materi telah dihapus selama proses pembuatan kuis.',
      });
      return { jobId, materialId, status: 'FAILED', errorCode: 'MATERIAL_DELETED', error: 'Materi telah dihapus' };
    }

    // Atomically save questions and mark quiz READY
    await finishAiJobAtomically({
      jobId,
      userId,
      status: 'COMPLETED',
      payload: {
        questionCount: aiResult.questions.length,
        durationMs: aiResult.durationMs,
      },
      onSuccessTx: async (tx) => {
        // Create new questions
        await tx.quizQuestion.createMany({
          data: aiResult.questions.map((q, idx) => ({
            quizId,
            question: q.question,
            options: q.options,
            correctIndex: q.correctIndex,
            explanation: q.explanation,
            pageReferences: q.pageReferences,
            orderIndex: idx,
          })),
        });

        await tx.quiz.update({
          where: { id: quizId },
          data: {
            title: aiResult.title,
            questionCount: aiResult.questions.length,
            status: 'READY',
            errorCode: null,
            errorMessage: null,
            activeJobId: null,
          },
        });
      },
    });

    return {
      jobId,
      materialId,
      status: 'READY',
      itemCount: aiResult.questions.length,
      durationMs: aiResult.durationMs,
    };
  } catch (err: any) {
    const isAiError = err instanceof AiProviderError;
    const errorCode = isAiError ? err.code : 'AI_GENERATION_FAILED';
    const errorMessage = err instanceof Error ? err.message : String(err);
    const isRetryable = isAiError ? err.isRetryable : false;

    console.error(
      JSON.stringify({
        level: 'error',
        timestamp: new Date().toISOString(),
        message: `[Worker] AI Quiz generation failed for job ${jobId}: ${errorMessage}`,
        errorCode,
        isRetryable,
      })
    );

    const willRetry = isRetryable && ((job.attemptsMade ?? 0) + 1 < (job.opts?.attempts || 3));
    if (willRetry) {
      throw err;
    }

    await finishAiJobAtomically({
      jobId,
      userId,
      status: 'FAILED',
      errorCode,
      errorMessage,
      onSuccessTx: async (tx) => {
        await tx.quiz.update({
          where: { id: quizId },
          data: {
            status: 'FAILED',
            errorCode,
            errorMessage,
            activeJobId: null,
          },
        });
      },
    });

    return {
      jobId,
      materialId,
      status: 'FAILED',
      errorCode,
      error: errorMessage,
    };
  }
}
