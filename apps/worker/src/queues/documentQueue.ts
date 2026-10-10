import { Job } from 'bullmq';
import {
  startDocumentJobAtomically,
  finishDocumentJobAtomically,
  failDocumentJobAtomically,
} from '@studyflow/database';
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

  console.log(
    JSON.stringify({
      level: 'info',
      timestamp: startedAt.toISOString(),
      message: `[Worker] Processing document extraction for job ${jobId}, material ${materialId}`,
      attempt: job.attemptsMade + 1,
    })
  );

  // 1. Atomically transition job to PROCESSING (guarded against duplicate/terminal execution)
  const startResult = await startDocumentJobAtomically({
    jobId,
    materialId,
    userId,
    attempts: (job.attemptsMade ?? 0) + 1,
  });

  if (!startResult.canProcess) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        timestamp: startedAt.toISOString(),
        message: `[Worker] Document job ${jobId} cannot be processed (status: ${startResult.status}, error: ${startResult.errorCode}). Aborting duplicate/terminal execution.`,
      })
    );
    return {
      jobId,
      materialId,
      status: startResult.status === 'COMPLETED' ? 'READY' : 'FAILED',
      errorCode: startResult.errorCode ?? undefined,
      error:
        startResult.errorCode === 'MATERIAL_DELETED'
          ? 'Materi telah dihapus sebelum pemrosesan'
          : undefined,
    };
  }

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

    // 4. Atomically commit extraction, mark material READY, commit storage quota
    const finishResult = await finishDocumentJobAtomically({
      jobId,
      materialId,
      userId,
      declaredBytes,
      actualBytes: extractionResult.actualBytes,
      pageCount: extractionResult.pageCount,
      pages: extractionResult.pages.map((p) => ({
        pageNumber: p.pageNumber,
        extractedText: p.text,
        characterCount: p.characterCount,
      })),
      emptyPagesMessage: extractionResult.hasEmptyPages
        ? `Beberapa halaman (${extractionResult.emptyPageNumbers.join(', ')}) tidak mengandung teks.`
        : null,
    });

    if (!finishResult.wasCommitted) {
      console.warn(
        JSON.stringify({
          level: 'warn',
          timestamp: new Date().toISOString(),
          message: `[Worker] Document job ${jobId} was not committed (final status: ${finishResult.status}, error: ${finishResult.errorCode}).`,
        })
      );
      return {
        jobId,
        materialId,
        status: finishResult.status === 'READY' ? 'READY' : 'FAILED',
        errorCode: finishResult.errorCode ?? undefined,
        error:
          finishResult.errorCode === 'MATERIAL_DELETED'
            ? 'Materi telah dihapus selama proses ekstraksi'
            : undefined,
      };
    }

    console.log(
      JSON.stringify({
        level: 'info',
        timestamp: new Date().toISOString(),
        message: `[Worker] Document ${materialId} processed successfully: ${extractionResult.pageCount} pages, ${extractionResult.totalCharacters} chars`,
      })
    );

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

    console.error(
      JSON.stringify({
        level: 'error',
        timestamp: new Date().toISOString(),
        message: `[Worker] Document processing failed for job ${jobId}: ${errorMessage}`,
        errorCode,
        isPermanent,
      })
    );

    const willRetry = !isPermanent && (job.attemptsMade ?? 0) + 1 < (job.opts?.attempts || 3);

    if (!willRetry) {
      await failDocumentJobAtomically({
        jobId,
        materialId,
        userId,
        declaredBytes,
        errorCode,
        errorMessage,
      });
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
