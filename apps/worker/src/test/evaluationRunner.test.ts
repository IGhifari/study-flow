import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  parseCliArgs,
  CliArgumentError,
  BudgetTrackedAdapter,
  evaluateDocument,
  evaluateNegativeFixture,
  runAiEvaluation,
  ManifestItem,
} from '../../../../scripts/run-ai-evaluation.js';
import {
  MockAiProviderAdapter,
  GeminiAiProviderAdapter,
  AiProviderError,
  AiQuizInput,
  AiQuizResult,
} from '../services/aiProvider.js';
import { extractPdfText } from '../services/pdfExtractor.js';

import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../../../');
const manifestPath = path.resolve(repoRoot, 'docs/ai_evaluation/manifest.json');
const fixtureBaseDir = path.resolve(repoRoot, 'docs/ai_evaluation');
const validFixtureDir = path.resolve(fixtureBaseDir, 'fixtures/valid');
const negativeFixtureDir = path.resolve(fixtureBaseDir, 'fixtures/negative');

describe('Evaluasi AI - Akuntabilitas dan Tata Kelola Runner', () => {
  it('1. File berekstensi .pdf yang rusak tidak otomatis lulus (Integritas Ekstraksi)', async () => {
    // A corrupted buffer disguised with a .pdf extension
    const corruptedPdfBuffer = Buffer.from('NOT_A_VALID_PDF_HEADER_CORRUPTED_BYTES_123456');

    // Real application extractor must reject it
    await expect(extractPdfText(corruptedPdfBuffer)).rejects.toThrow();

    // Create a temporary pseudo manifest item pointing to corrupted file
    const tempCorruptedPath = path.resolve(validFixtureDir, 'temp-test-corrupted.pdf');
    fs.writeFileSync(tempCorruptedPath, corruptedPdfBuffer);

    try {
      const mockDoc: ManifestItem = {
        id: 'test-corrupted-extension',
        filename: 'temp-test-corrupted.pdf',
        relativePath: 'fixtures/valid/temp-test-corrupted.pdf',
        title: 'Corrupted File Test',
        language: 'id',
        type: 'short',
        structure: 'single-column',
        pageCount: 2,
        bytes: corruptedPdfBuffer.length,
        isSynthetic: true,
        originNotice: 'Test',
      };

      const result = await evaluateDocument(mockDoc, validFixtureDir, new MockAiProviderAdapter(), 'mock');

      // MUST NOT pass simply because filename ends with .pdf!
      expect(result.overallStatus).toBe('FAIL');
      expect(result.criteria.pdfExtraction.status).toBe('FAIL');
      expect(result.criteria.pdfExtraction.detail).toContain('Gagal mengekstrak teks PDF');
    } finally {
      if (fs.existsSync(tempCorruptedPath)) {
        fs.unlinkSync(tempCorruptedPath);
      }
    }
  });

  it('2. Referensi halaman invalid menghasilkan FAIL (Provenance Out-of-Bounds)', async () => {
    // Valid 2-page document
    const doc: ManifestItem = {
      id: 'id-cs101-algoritma-pemrograman',
      filename: 'id-cs101-algoritma-pemrograman.pdf',
      relativePath: 'docs/ai_evaluation/fixtures/valid/id-cs101-algoritma-pemrograman.pdf',
      title: 'Dasar Algoritma dan Pemrograman Komputer',
      language: 'id',
      type: 'short',
      structure: 'single-column',
      pageCount: 2,
      bytes: 2253,
      isSynthetic: true,
      originNotice: 'Test',
    };

    // Create a mock adapter that produces a question referencing page 99 (invalid: doc only has 2 pages)
    const customAdapter = new MockAiProviderAdapter();
    customAdapter.setCustomQuizHandler(async (input: AiQuizInput): Promise<AiQuizResult> => {
      return {
        title: `Kuis: ${input.materialTitle}`,
        questions: [
          {
            question: 'Pertanyaan dengan rujukan halaman halusinasi?',
            options: ['Opsi A', 'Opsi B', 'Opsi C', 'Opsi D'],
            correctIndex: 0,
            explanation: 'Penjelasan opsi A',
            pageReferences: [99], // INVALID: Page 99 does not exist in 2-page document!
          },
        ],
        durationMs: 10,
      };
    });

    const result = await evaluateDocument(doc, validFixtureDir, customAdapter, 'mock');

    // Page references criteria and overall evaluation MUST FAIL
    expect(result.criteria.pageReferences.status).toBe('FAIL');
    expect(result.criteria.pageReferences.detail).toContain('berada di luar batas dokumen');
    expect(result.overallStatus).toBe('FAIL');
  });

  it('3. Mock tidak menghasilkan klaim akurasi faktual (Pemisahan Layer 2 vs Layer 3)', async () => {
    const doc: ManifestItem = {
      id: 'id-cs101-algoritma-pemrograman',
      filename: 'id-cs101-algoritma-pemrograman.pdf',
      relativePath: 'docs/ai_evaluation/fixtures/valid/id-cs101-algoritma-pemrograman.pdf',
      title: 'Dasar Algoritma dan Pemrograman Komputer',
      language: 'id',
      type: 'short',
      structure: 'single-column',
      pageCount: 2,
      bytes: 2253,
      isSynthetic: true,
      originNotice: 'Test',
    };

    const mockAdapter = new MockAiProviderAdapter();
    const result = await evaluateDocument(doc, validFixtureDir, mockAdapter, 'mock');

    // Structure and schema passed
    expect(result.criteria.quizStructuralValidity.status).toBe('PASS');

    // BUT factual accuracy MUST be NOT_EVALUATED, never PASS or fabricated percentage!
    expect(result.criteria.quizAnswerKeyFactualAccuracy.status).toBe('NOT_EVALUATED');
    expect(result.criteria.quizAnswerKeyFactualAccuracy.detail).toContain('Mode mock hanya memvalidasi struktur');
  });

  it('4. Kriteria belum dinilai tetap NOT_EVALUATED (Tidak dihitung lulus)', async () => {
    const { reportData } = await runAiEvaluation({
      provider: 'mock',
      limit: 2,
      validOnly: true,
      negativeOnly: false,
      manifestPath,
    });

    // In mock mode, prompt injection defense and factual accuracy are NOT_EVALUATED
    expect(reportData.summaryMetrics.unreviewedCriteriaCount).toBeGreaterThan(0);
    expect(reportData.summaryMetrics.quizQuestionsFactualAccuracyReviewed).toBe(0);
    expect(reportData.summaryMetrics.quizQuestionsFactualAccuracyPassed).toBe(0);

    // Unreviewed criteria MUST NOT inflate passed counts
    for (const doc of reportData.validDocuments) {
      expect(doc.criteria.quizAnswerKeyFactualAccuracy.status).toBe('NOT_EVALUATED');
      expect(doc.criteria.modelPromptInjectionDefense.status).toBe('NOT_EVALUATED');
    }

    // Verdict explicitly acknowledges mock limitation
    expect(reportData.overallVerdict).toBe('PASS_MOCK');
    expect(reportData.overallVerdict).not.toBe('PASS_LIVE');
  });

  it('5. Argumen provider/CLI invalid ditolak secara ketat', () => {
    // 1. Unsupported provider
    expect(() => parseCliArgs(['--provider=openai'])).toThrow(CliArgumentError);
    expect(() => parseCliArgs(['--provider=openai'])).toThrow(/Penyedia AI "openai" tidak didukung/);

    // 2. Unrecognized argument
    expect(() => parseCliArgs(['--unknown-flag'])).toThrow(CliArgumentError);
    expect(() => parseCliArgs(['--unknown-flag'])).toThrow(/Opsi CLI tidak didukung/);

    // 3. Invalid limit
    expect(() => parseCliArgs(['--limit=-5'])).toThrow(CliArgumentError);
    expect(() => parseCliArgs(['--limit=abc'])).toThrow(CliArgumentError);

    // 4. Invalid max calls
    expect(() => parseCliArgs(['--max-calls=0'])).toThrow(CliArgumentError);

    // 5. Conflicting flags
    expect(() => parseCliArgs(['--negative-only', '--valid-only'])).toThrow(CliArgumentError);

    // 6. Valid options parse cleanly
    const validParsed = parseCliArgs(['--provider=mock', '--limit=5', '--max-calls=15']);
    expect(validParsed.provider).toBe('mock');
    expect(validParsed.limit).toBe(5);
    expect(validParsed.maxCalls).toBe(15);
  });

  it('6. Pemeriksaan wajib yang gagal menghasilkan status gagal (exit code nonzero)', () => {
    const tsxCli = path.resolve(repoRoot, 'node_modules/tsx/dist/cli.mjs');
    const runnerScript = path.resolve(repoRoot, 'scripts/run-ai-evaluation.ts');

    // 6a. Argumen CLI tidak sah harus keluar dengan exit code 1
    const invalidArgProc = spawnSync(
      process.execPath,
      [tsxCli, runnerScript, '--invalid-argument-test-flag'],
      {
        encoding: 'utf-8',
        cwd: repoRoot,
      }
    );
    expect(invalidArgProc.status).toBe(1);
    expect(invalidArgProc.stderr).toContain('[ERROR CLI]');

    // 6b. Pemeriksaan wajib fixture yang gagal harus menyebabkan proses CLI keluar dengan exit code 1
    const tempFailingManifestPath = path.resolve(fixtureBaseDir, 'temp-failing-manifest.json');
    const failingManifest = {
      schemaVersion: '1.0.0',
      datasetName: 'Failing Test Manifest',
      validDocuments: [],
      negativeFixtures: [
        {
          id: 'negative-faulty-check',
          filename: 'id-cs101-algoritma-pemrograman.pdf', // PDF valid sengaja ditempatkan di daftar negatif
          category: 'FILE_CORRUPTED',
          expectedError: 'FILE_CORRUPTED',
          description: 'Fixture yang sengaja gagal',
        },
      ],
    };
    fs.writeFileSync(tempFailingManifestPath, JSON.stringify(failingManifest, null, 2), 'utf-8');

    try {
      const failingProc = spawnSync(
        process.execPath,
        [tsxCli, runnerScript, `--manifest=${tempFailingManifestPath}`],
        {
          encoding: 'utf-8',
          cwd: repoRoot,
        }
      );
      // Proses CLI WAJIB keluar dengan exit code 1 (nonzero)
      expect(failingProc.status).toBe(1);
      expect(failingProc.stderr).toContain('[FATAL] Satu atau lebih pemeriksaan wajib gagal. Evaluasi berakhir dengan exit code 1.');
    } finally {
      if (fs.existsSync(tempFailingManifestPath)) {
        fs.unlinkSync(tempFailingManifestPath);
      }
    }
  });

  it('7. Batas panggilan mode live diuji memakai transport mock tanpa akses AI (Chunk & Retry)', async () => {
    // 7a. Uji Kasus Multi-Chunk: Dokumen membutuhkan 3 request (2 chunk + 1 merge), Budget = 2
    const sentChunkHttpRequests: string[] = [];
    const mockChunkFetch = vi.fn(async (url: string | URL | Request) => {
      sentChunkHttpRequests.push(String(url));
      const responseBody = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    keyConcepts: [{ concept: 'Konsep Chunk', explanation: 'Penjelasan konsep', pageReferences: [1] }],
                    sections: [{ heading: 'Bab Bagian', content: 'Uraian isi bab bagian ini', pageReferences: [1] }],
                  }),
                },
              ],
            },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: { promptTokenCount: 150, candidatesTokenCount: 100 },
      };
      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const geminiChunkAdapter = new GeminiAiProviderAdapter('mock-api-key', 'gemini-2.5-flash', {
      fetchFn: mockChunkFetch as unknown as typeof fetch,
    });
    const trackedChunk = new BudgetTrackedAdapter(geminiChunkAdapter, 2);

    // Multi-chunk input: 2 halaman masing-masing 30.000 karakter (> 40.000 batas satu chunk) -> menghasilkan 2 chunks + 1 merge = 3 request
    const multiChunkInput = {
      materialTitle: 'Materi Kuliah Multi-Chunk',
      pages: [
        { pageNumber: 1, text: 'A'.repeat(30000) },
        { pageNumber: 2, text: 'B'.repeat(30000) },
      ],
      totalPages: 2,
    };

    // Eksekusi generateSummary multi-chunk harus terhenti oleh AI_BUDGET_EXCEEDED saat mencoba request ke-3 (merge)
    await expect(trackedChunk.generateSummary(multiChunkInput)).rejects.toThrow(AiProviderError);

    // BUKTI: TEPAT 2 request HTTP yang dikirim, percobaan ke-3 ditahan sebelum request provider dikirim!
    expect(sentChunkHttpRequests.length).toBe(2);
    expect(trackedChunk.getCallCount()).toBe(2);

    // 7b. Uji Kasus Retry: Alur mencoba retry ketika terjadi 503 error, Budget = 2
    const sentRetryHttpRequests: string[] = [];
    const mockRetryFetch = vi.fn(async (url: string | URL | Request) => {
      sentRetryHttpRequests.push(String(url));
      return new Response(JSON.stringify({ error: { message: 'Layanan AI 503 Sedang Sibuk' } }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const geminiRetryAdapter = new GeminiAiProviderAdapter('mock-api-key', 'gemini-2.5-flash', {
      fetchFn: mockRetryFetch as unknown as typeof fetch,
    });
    const trackedRetry = new BudgetTrackedAdapter(geminiRetryAdapter, 2);

    let lastError: any = null;
    // Alur caller melakukan 3 kali percobaan (request awal + 2 retry)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await trackedRetry.generateQuiz({
          materialTitle: 'Materi Percobaan Retry',
          pages: [{ pageNumber: 1, text: 'Teks dokumen singkat untuk kuis' }],
          totalPages: 1,
          targetCount: 3,
        });
      } catch (err: any) {
        lastError = err;
        if (err.code === 'AI_BUDGET_EXCEEDED') {
          break;
        }
      }
    }

    // BUKTI: Percobaan ke-3 ditolak seketika oleh budget limiter dengan AI_BUDGET_EXCEEDED sebelum HTTP fetch dikirim!
    expect(lastError).toBeInstanceOf(AiProviderError);
    expect(lastError.code).toBe('AI_BUDGET_EXCEEDED');
    expect(lastError.statusCode).toBe(429);
    // TEPAT 2 request HTTP yang terkirim (percobaan 1 dan retry 1), retry 2 TIDAK terkirim!
    expect(sentRetryHttpRequests.length).toBe(2);
    expect(trackedRetry.getCallCount()).toBe(2);
  });

  it('8. Laporan menyebut jumlah sampel yang benar-benar diproses', async () => {
    const limitSample = 3;
    const { reportData, reportMarkdown } = await runAiEvaluation({
      provider: 'mock',
      limit: limitSample,
      validOnly: true,
      negativeOnly: false,
      manifestPath,
    });

    // Exactly 3 documents processed
    expect(reportData.validDocumentsProcessed).toBe(limitSample);
    expect(reportData.validDocumentsTarget).toBe(20);
    expect(reportData.validDocuments.length).toBe(limitSample);

    // Markdown report clearly documents processed count
    expect(reportMarkdown).toContain(`**Sampel Dokumen Valid Diproses** | 3 dari 20 berkas`);
    expect(reportMarkdown).toContain(`Dokumen Valid Lulus Uji Struktur & Skema:** 3/3`);
  });
});
