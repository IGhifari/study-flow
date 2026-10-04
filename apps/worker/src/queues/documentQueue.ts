import { Job } from 'bullmq';
import { prisma } from '@studyflow/database';
import { extractPdfText, PdfValidationError } from '../services/pdfExtractor.js';
import { getWorkerStorageAdapter } from '../services/storageAdapter.js';

export interface DocumentJobData {
  jobId: string;
  materialId: string;
  userId: string;
  storageKey: string;
  declaredBytes: number;
}

export interface DocumentJobResult {
  jobId: string;
  materialId: string;
  status: 'READY' | 'FAILED';
  pageCount?: number;
  totalCharacters?: number;
  error?: string;
  errorCode?: string;
}

export async function processDocumentJob(
  job: Job<DocumentJobData, DocumentJobResult>
): Promise<DocumentJobResult> {
  const { jobId, materialId, userId, storageKey, declaredBytes } = job.data;
  const startedAt = new Date();

  console.log(JSON.stringify({
    level: 'info',
    timestamp: startedAt.toISOString(),
    message: `[Worker] Processing document extraction for job ${jobId}, material ${materialId}`,
    attempt: job.attemptsMade + 1,
  }));

  // 1. Verify Material still exists and is not soft-deleted
  const material = await prisma.material.findFirst({
    where: { id: materialId, userId },
  });

  if (!material || material.deletedAt !== null) {
    console.log(JSON.stringify({
      level: 'warn',
      timestamp: new Date().toISOString(),
      message: `[Worker] Material ${materialId} was deleted or not found. Skipping extraction.`,
    }));
    return {
      jobId,
      materialId,
      status: 'FAILED',
      errorCode: 'MATERIAL_DELETED',
      error: 'Materi telah dihapus sebelum atau selama pemrosesan',
    };
  }

  // Update ProcessingJob to PROCESSING
  await prisma.processingJob.updateMany({
    where: { id: jobId },
    data: {
      status: 'PROCESSING',
      startedAt,
      attempts: job.attemptsMade + 1,
    },
  });

  // Update Material status to PROCESSING
  await prisma.material.update({
    where: { id: materialId },
    data: {
      status: 'PROCESSING',
    },
  });

  let downloadedBuffer: Buffer | null = null;

  try {
    // 2. Fetch object from Storage
    const storageAdapter = getWorkerStorageAdapter();
    const downloadRes = await storageAdapter.download(storageKey);

    if (downloadRes.error || !downloadRes.data) {
      throw new Error(
        `Gagal mengunduh file dari storage: ${downloadRes.error?.message || 'Data kosong'}`
      );
    }

    if (Buffer.isBuffer(downloadRes.data)) {
      downloadedBuffer = downloadRes.data;
    } else if (downloadRes.data instanceof ArrayBuffer) {
      downloadedBuffer = Buffer.from(downloadRes.data);
    } else if (typeof (downloadRes.data as any).arrayBuffer === 'function') {
      const ab = await (downloadRes.data as any).arrayBuffer();
      downloadedBuffer = Buffer.from(ab);
    } else {
      throw new Error('Format file buffer dari storage tidak didukung');
    }

    // 3. Extract text per page and validate
    const extractionResult = await extractPdfText(downloadedBuffer, { timeoutMs: 30000 });

    // 4. Check again whether material was deleted while parsing
    const freshCheck = await prisma.material.findFirst({
      where: { id: materialId, userId },
      select: { deletedAt: true },
    });

    if (!freshCheck || freshCheck.deletedAt !== null) {
      console.log(JSON.stringify({
        level: 'warn',
        timestamp: new Date().toISOString(),
        message: `[Worker] Material ${materialId} was deleted during extraction. Aborting persistence.`,
      }));
      return {
        jobId,
        materialId,
        status: 'FAILED',
        errorCode: 'MATERIAL_DELETED',
        error: 'Materi telah dihapus selama proses ekstraksi',
      };
    }

    // 5. Atomically persist MaterialPages, update Material -> READY, update storage quota
    await prisma.$transaction(async (tx) => {
      // Clear any previous partial pages for idempotency
      await tx.materialPage.deleteMany({
        where: { materialId },
      });

      // Insert pages with 1-based page numbers
      await tx.materialPage.createMany({
        data: extractionResult.pages.map((p) => ({
          materialId,
          pageNumber: p.pageNumber,
          extractedText: p.text,
          characterCount: p.characterCount,
        })),
      });

      // Update Material to READY with verified bytes and pageCount
      await tx.material.update({
        where: { id: materialId },
        data: {
          status: 'READY',
          pageCount: extractionResult.pageCount,
          bytes: extractionResult.actualBytes,
          errorCode: null,
          errorMessage: extractionResult.hasEmptyPages
            ? `Beberapa halaman (${extractionResult.emptyPageNumbers.join(', ')}) tidak mengandung teks.`
            : null,
        },
      });

      // Commit storage quota: consume reservation and commit actual used bytes
      const usage = await tx.storageUsage.findUnique({
        where: { userId },
      });
      if (usage) {
        const toDecrement = Math.min(Number(usage.reservedBytes), declaredBytes);
        await tx.storageUsage.update({
          where: { userId },
          data: {
            reservedBytes: {
              decrement: BigInt(toDecrement),
            },
            usedBytes: {
              increment: BigInt(extractionResult.actualBytes),
            },
          },
        });
      }

      // Mark ProcessingJob COMPLETED
      await tx.processingJob.updateMany({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
    });

    console.log(JSON.stringify({
      level: 'info',
      timestamp: new Date().toISOString(),
      message: `[Worker] Document ${materialId} processed successfully: ${extractionResult.pageCount} pages, ${extractionResult.totalCharacters} chars`,
    }));

    return {
      jobId,
      materialId,
      status: 'READY',
      pageCount: extractionResult.pageCount,
      totalCharacters: extractionResult.totalCharacters,
    };
  } catch (err: any) {
    const isValidationErr = err instanceof PdfValidationError;
    const errorCode = isValidationErr ? err.code : 'EXTRACTION_FAILED';
    const errorMessage = err instanceof Error ? err.message : String(err);
    const isPermanent = isValidationErr ? err.isPermanent : false;

    console.error(JSON.stringify({
      level: 'error',
      timestamp: new Date().toISOString(),
      message: `[Worker] Document processing failed for job ${jobId}: ${errorMessage}`,
      errorCode,
      isPermanent,
    }));

    // Check material existence before recording failure
    const checkMat = await prisma.material.findUnique({
      where: { id: materialId },
      select: { deletedAt: true },
    });

    if (checkMat && checkMat.deletedAt === null) {
      // If failure is permanent (or max attempts reached), mark Material as FAILED and release reservation
      const willRetry = !isPermanent && job.attemptsMade + 1 < (job.opts.attempts || 3);

      if (!willRetry) {
        await prisma.$transaction(async (tx) => {
          await tx.material.update({
            where: { id: materialId },
            data: {
              status: 'FAILED',
              errorCode,
              errorMessage,
            },
          });

          await tx.processingJob.updateMany({
            where: { id: jobId },
            data: {
              status: 'FAILED',
              errorCode,
              errorMessage,
              failedAt: new Date(),
            },
          });

          // Release storage reservation because file failed to become READY
          const usage = await tx.storageUsage.findUnique({
            where: { userId },
          });
          if (usage) {
            const toDecrement = Math.min(Number(usage.reservedBytes), declaredBytes);
            if (toDecrement > 0) {
              await tx.storageUsage.update({
                where: { userId },
                data: {
                  reservedBytes: {
                    decrement: BigInt(toDecrement),
                  },
                },
              });
            }
          }
        });
      }
    }

    if (isPermanent) {
      // Do not throw; return FAILED result so BullMQ does not retry non-retryable validation error
      return {
        jobId,
        materialId,
        status: 'FAILED',
        errorCode,
        error: errorMessage,
      };
    }

    // Re-throw temporary errors for BullMQ automatic retry with backoff
    throw err;
  } finally {
    downloadedBuffer = null;
  }
}
