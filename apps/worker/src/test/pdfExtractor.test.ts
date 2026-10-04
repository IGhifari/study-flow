import { describe, it, expect } from 'vitest';
import {
  validatePdfSignature,
  extractPdfText,
  PdfValidationError,
} from '../services/pdfExtractor.js';

describe('PDF Extractor Unit & Validation Tests', () => {
  const textContent =
    'StudyFlow adalah platform belajar pribadi untuk mahasiswa dan kuliah.';
  const streamBody = `BT\n/F1 12 Tf\n100 700 Td\n(${textContent}) Tj\nET\n`;
  const streamLen = Buffer.byteLength(streamBody, 'ascii');

  const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  const obj2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
  const obj3 =
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents 4 0 R >>\nendobj\n';
  const obj4 = `4 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamBody}endstream\nendobj\n`;

  const header = '%PDF-1.4\n';
  const off1 = Buffer.byteLength(header, 'ascii');
  const off2 = off1 + Buffer.byteLength(obj1, 'ascii');
  const off3 = off2 + Buffer.byteLength(obj2, 'ascii');
  const off4 = off3 + Buffer.byteLength(obj3, 'ascii');
  const xrefOffset = off4 + Buffer.byteLength(obj4, 'ascii');

  const pad = (n: number) => String(n).padStart(10, '0');
  const xref =
    `xref\n0 5\n0000000000 65535 f \n${pad(off1)} 00000 n \n${pad(off2)} 00000 n \n${pad(off3)} 00000 n \n${pad(off4)} 00000 n \n` +
    `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const minimalValidTextPdf = Buffer.from(
    header + obj1 + obj2 + obj3 + obj4 + xref,
    'ascii'
  );

  const minimalPdfNoText = Buffer.from(
`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 15 >>
stream
10 10 100 100 re
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000201 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
266
%%EOF`
  );

  describe('validatePdfSignature', () => {
    it('should pass for valid PDF header', () => {
      expect(() => validatePdfSignature(Buffer.from('%PDF-1.7 mock'))).not.toThrow();
    });

    it('should throw FILE_CORRUPTED if buffer is too short', () => {
      expect(() => validatePdfSignature(Buffer.from('%PD'))).toThrow(PdfValidationError);
      try {
        validatePdfSignature(Buffer.from('%PD'));
      } catch (err: any) {
        expect(err.code).toBe('FILE_CORRUPTED');
      }
    });

    it('should throw INVALID_FILE_SIGNATURE for non-PDF headers', () => {
      expect(() => validatePdfSignature(Buffer.from('<html><body>Not PDF</body></html>'))).toThrow(
        PdfValidationError
      );
      try {
        validatePdfSignature(Buffer.from('GIF89a'));
      } catch (err: any) {
        expect(err.code).toBe('INVALID_FILE_SIGNATURE');
      }
    });
  });

  describe('extractPdfText', () => {
    it('should reject file exceeding 20 MB limit', async () => {
      const oversizedBuffer = Buffer.alloc(20 * 1024 * 1024 + 1024);
      oversizedBuffer.write('%PDF-1.4');

      await expect(extractPdfText(oversizedBuffer)).rejects.toThrow(
        expect.objectContaining({ code: 'FILE_TOO_LARGE' })
      );
    });

    it('should reject corrupted PDF structure', async () => {
      const corruptBuffer = Buffer.from('%PDF-1.4 completely invalid garbage binary content');
      await expect(extractPdfText(corruptBuffer)).rejects.toThrow(
        expect.objectContaining({ code: 'FILE_CORRUPTED' })
      );
    });

    it('should reject scanned/image PDF without extractable text', async () => {
      await expect(extractPdfText(minimalPdfNoText)).rejects.toThrow(
        expect.objectContaining({ code: 'SCANNED_PDF_NO_TEXT' })
      );
    });

    it('should extract text per page with 1-based indexing from valid text-based PDF', async () => {
      const result = await extractPdfText(minimalValidTextPdf);

      expect(result.pageCount).toBe(1);
      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].pageNumber).toBe(1);
      expect(result.pages[0].text).toContain('StudyFlow adalah platform belajar pribadi');
      expect(result.pages[0].characterCount).toBeGreaterThan(0);
      expect(result.totalCharacters).toBeGreaterThan(0);
      expect(result.hasEmptyPages).toBe(false);
    });

    it('should reject encrypted or password-protected PDF with FILE_ENCRYPTED', async () => {
      const encryptedPdf = Buffer.from(
        `%PDF-1.4\n` +
          `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n` +
          `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n` +
          `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n` +
          `trailer\n<< /Size 4 /Root 1 0 R /Encrypt << /Filter /Standard /V 2 /R 3 /O (12345678901234567890123456789012) /U (12345678901234567890123456789012) /P -4 >> >>\n` +
          `startxref\n100\n%%EOF`
      );

      await expect(extractPdfText(encryptedPdf)).rejects.toThrow(
        expect.objectContaining({ code: 'FILE_ENCRYPTED' })
      );
    });

    it('should reject PDF exceeding 100 pages with EXCEEDS_PAGE_LIMIT', async () => {
      const kids: string[] = [];
      const pageObjs: string[] = [];
      for (let i = 1; i <= 101; i++) {
        const pageNum = i + 2;
        kids.push(`${pageNum} 0 R`);
        pageObjs.push(
          `${pageNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n`
        );
      }
      const multiPagePdf = Buffer.from(
        `%PDF-1.4\n` +
          `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n` +
          `2 0 obj\n<< /Type /Pages /Kids [${kids.join(' ')}] /Count 101 >>\nendobj\n` +
          pageObjs.join('') +
          `trailer\n<< /Size 104 /Root 1 0 R >>\nstartxref\n100\n%%EOF`
      );

      await expect(extractPdfText(multiPagePdf)).rejects.toThrow(
        expect.objectContaining({ code: 'EXCEEDS_PAGE_LIMIT' })
      );
    });

    it('should detect mixed PDF and record empty pages while preserving valid pages', async () => {
      const text = 'Materi perkuliahan StudyFlow pada halaman pertama lengkap dengan teks.';
      const streamBody = `BT\n/F1 12 Tf\n100 700 Td\n(${text}) Tj\nET\n`;
      const streamLen = Buffer.byteLength(streamBody, 'ascii');

      const mixedPdf = Buffer.from(
        `%PDF-1.4\n` +
          `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n` +
          `2 0 obj\n<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>\nendobj\n` +
          `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents 4 0 R >>\nendobj\n` +
          `4 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamBody}endstream\nendobj\n` +
          `5 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R >>\nendobj\n` +
          `6 0 obj\n<< /Length 15 >>\nstream\n10 10 100 100 re\nendstream\nendobj\n` +
          `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n100\n%%EOF`
      );

      const result = await extractPdfText(mixedPdf);

      expect(result.pageCount).toBe(2);
      expect(result.pages).toHaveLength(2);
      expect(result.hasEmptyPages).toBe(true);
      expect(result.emptyPageNumbers).toContain(2);
      expect(result.pages[0].text).toContain('StudyFlow');
      expect(result.pages[1].characterCount).toBe(0);
    });

    it('should abort parsing when timeout limit is reached with PARSING_TIMEOUT', async () => {
      await expect(
        extractPdfText(minimalValidTextPdf, { timeoutMs: 0 })
      ).rejects.toThrow(
        expect.objectContaining({ code: 'PARSING_TIMEOUT' })
      );
    });
  });
});
