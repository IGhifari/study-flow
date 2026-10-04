import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { FILE_UPLOAD_LIMITS } from '@studyflow/shared';

export interface ExtractedPage {
  pageNumber: number;
  text: string;
  characterCount: number;
}

export interface ExtractionResult {
  pageCount: number;
  actualBytes: number;
  pages: ExtractedPage[];
  totalCharacters: number;
  hasEmptyPages: boolean;
  emptyPageNumbers: number[];
}

export class PdfValidationError extends Error {
  code: string;
  isPermanent: boolean;

  constructor(code: string, message: string, isPermanent = true) {
    super(message);
    this.name = 'PdfValidationError';
    this.code = code;
    this.isPermanent = isPermanent;
  }
}

/**
 * Validates PDF magic bytes (%PDF-).
 */
export function validatePdfSignature(buffer: Buffer): void {
  if (buffer.length < 5) {
    throw new PdfValidationError('FILE_CORRUPTED', 'File terlalu kecil atau rusak');
  }

  const header = buffer.subarray(0, 5).toString('ascii');
  if (header !== '%PDF-') {
    throw new PdfValidationError(
      'INVALID_FILE_SIGNATURE',
      'Header file tidak valid. Dokumen bukan file PDF standar.'
    );
  }
}

/**
 * Extracts text and validates text-based PDF constraints according to PRD.
 * - Text-based PDF only (rejects scanned PDF without text).
 * - Max 20 MB (20 * 1024 * 1024 bytes).
 * - Max 100 pages.
 * - Text per page with page index starting from 1.
 */
export async function extractPdfText(
  pdfBuffer: Buffer,
  options?: { timeoutMs?: number }
): Promise<ExtractionResult> {
  const timeoutMs = options?.timeoutMs !== undefined ? options.timeoutMs : 30000; // 30s timeout per document

  // 1. Signature and size check
  validatePdfSignature(pdfBuffer);

  const actualBytes = pdfBuffer.length;
  if (actualBytes > FILE_UPLOAD_LIMITS.maxSizeBytes) {
    throw new PdfValidationError(
      'FILE_TOO_LARGE',
      `Ukuran file aktual melebihi batas 20 MB (${(actualBytes / (1024 * 1024)).toFixed(1)} MB)`
    );
  }

  // 2. Parse PDF with pdfjs-dist
  const uint8Array = new Uint8Array(
    pdfBuffer.buffer,
    pdfBuffer.byteOffset,
    pdfBuffer.byteLength
  );

  let loadingTask: any;
  let timer: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    if (timeoutMs <= 0) {
      reject(
        new PdfValidationError(
          'PARSING_TIMEOUT',
          'Pemrosesan dokumen melebihi batas waktu maksimal (30 detik).',
          false
        )
      );
      return;
    }
    timer = setTimeout(() => {
      if (loadingTask && typeof loadingTask.destroy === 'function') {
        loadingTask.destroy().catch(() => {});
      }
      reject(
        new PdfValidationError(
          'PARSING_TIMEOUT',
          'Pemrosesan dokumen melebihi batas waktu maksimal (30 detik).',
          false
        )
      );
    }, timeoutMs);
  });

  const parsePromise = (async (): Promise<ExtractionResult> => {
    let pdfDoc: any;
    try {
      loadingTask = pdfjsLib.getDocument({
        data: uint8Array,
        useSystemFonts: true,
        disableFontFace: true,
        stopAtErrors: false,
      });

      pdfDoc = await loadingTask.promise;
    } catch (err: any) {
      const errName = String(err?.name || '');
      const errStr = String(err?.message || err).toLowerCase();
      if (
        errName === 'PasswordException' ||
        errStr.includes('password') ||
        errStr.includes('encrypt')
      ) {
        throw new PdfValidationError(
          'FILE_ENCRYPTED',
          'Dokumen PDF diproteksi kata sandi (terenkripsi) dan tidak dapat diekstrak'
        );
      }
      throw new PdfValidationError(
        'FILE_CORRUPTED',
        'Dokumen PDF rusak atau struktur data tidak dapat dibaca oleh parser'
      );
    }

    const pageCount = pdfDoc.numPages;
    if (pageCount === 0) {
      throw new PdfValidationError('FILE_CORRUPTED', 'Dokumen PDF tidak memiliki halaman');
    }

    if (pageCount > FILE_UPLOAD_LIMITS.maxPages) {
      throw new PdfValidationError(
        'EXCEEDS_PAGE_LIMIT',
        `Jumlah halaman (${pageCount}) melebihi batas maksimal 100 halaman.`
      );
    }

    const pages: ExtractedPage[] = [];
    let totalCharacters = 0;
    const emptyPageNumbers: number[] = [];

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();

        // Concatenate text items preserving spacing
        let pageText = '';
        let lastY: number | null = null;

        for (const item of textContent.items) {
          if ('str' in item) {
            const currentY = item.transform?.[5] ?? null;
            if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 5) {
              pageText += '\n';
            } else if (pageText.length > 0 && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
              pageText += ' ';
            }
            pageText += item.str;
            lastY = currentY;
          }
        }

        const trimmedText = pageText.trim();
        const charCount = trimmedText.length;

        if (charCount < 5) {
          emptyPageNumbers.push(pageNum);
        }

        totalCharacters += charCount;
        pages.push({
          pageNumber: pageNum,
          text: trimmedText,
          characterCount: charCount,
        });

        page.cleanup();
      } catch (err: any) {
        console.warn(`[PdfExtractor] Failed extracting page ${pageNum}:`, err?.message);
        emptyPageNumbers.push(pageNum);
        pages.push({
          pageNumber: pageNum,
          text: '',
          characterCount: 0,
        });
      }
    }

    // 3. Reject pure scanned PDFs without any text
    // If total characters across entire document is extremely low (< 30 chars for whole doc)
    if (totalCharacters < 30) {
      throw new PdfValidationError(
        'SCANNED_PDF_NO_TEXT',
        'Teks belum ditemukan. PDF hasil scan gambar tanpa lapisan teks belum didukung (OCR belum tersedia pada versi ini).'
      );
    }

    return {
      pageCount,
      actualBytes,
      pages,
      totalCharacters,
      hasEmptyPages: emptyPageNumbers.length > 0,
      emptyPageNumbers,
    };
  })();

  try {
    return await Promise.race([parsePromise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
