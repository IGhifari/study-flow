import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { extractPdfText, PdfValidationError } from '../apps/worker/src/services/pdfExtractor.js';
import {
  MockAiProviderAdapter,
  GeminiAiProviderAdapter,
  AiProviderError,
  AiProviderAdapter,
  AiSummaryInput,
  AiSummaryResult,
  AiFlashcardInput,
  AiFlashcardResult,
  AiQuizInput,
  AiQuizResult,
} from '../apps/worker/src/services/aiProvider.js';
import {
  SummaryStructuredOutputSchema,
  FlashcardSetStructuredOutputSchema,
  QuizStructuredOutputSchema,
} from '@studyflow/shared';

// ============================================================================
// Types & Interfaces
// ============================================================================

export type EvaluationStatus = 'PASS' | 'FAIL' | 'NOT_EVALUATED' | 'ERROR';

export interface CliOptions {
  provider: 'mock' | 'gemini';
  limit?: number;
  maxCalls?: number;
  negativeOnly: boolean;
  validOnly: boolean;
  manifestPath: string;
  outputPath?: string;
  help?: boolean;
}

export class CliArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliArgumentError';
  }
}

export interface ManifestItem {
  id: string;
  filename: string;
  relativePath: string;
  title: string;
  language: string;
  type: string;
  structure: string;
  pageCount: number;
  bytes: number;
  isSynthetic: boolean;
  originNotice: string;
}

export interface NegativeFixtureItem {
  id: string;
  filename: string;
  category: string;
  description: string;
  expectedError?: string;
  expectedBehavior?: string;
}

export interface Manifest {
  version: string;
  createdAt: string;
  targetMilestone: string;
  description: string;
  validDocumentsCount: number;
  negativeFixturesCount: number;
  validDocuments: ManifestItem[];
  negativeFixtures: NegativeFixtureItem[];
}

export interface CriteriaResult {
  name: string;
  status: EvaluationStatus;
  detail: string;
  evidence?: string;
}

export interface DocumentEvaluationResult {
  id: string;
  filename: string;
  language: string;
  fileHashSha256: string;
  fileSizeBytes: number;
  expectedPageCount: number;
  extractedPageCount: number;
  extractedCharacters: number;
  overallStatus: EvaluationStatus;
  criteria: {
    pdfExtraction: CriteriaResult;
    pageReferences: CriteriaResult;
    summarySchema: CriteriaResult;
    flashcardSchema: CriteriaResult;
    quizStructuralValidity: CriteriaResult;
    quizAnswerKeyFactualAccuracy: CriteriaResult;
    modelPromptInjectionDefense: CriteriaResult;
  };
  sampleQuizQuestions: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    pageReferences: number[];
  }[];
}

export interface NegativeFixtureResult {
  id: string;
  filename: string;
  category: string;
  expectedError?: string;
  expectedBehavior?: string;
  status: EvaluationStatus;
  detail: string;
  isSimulatedWarning?: boolean;
}

export interface ManualReviewItem {
  docId: string;
  docTitle: string;
  category: 'summary' | 'flashcard' | 'quiz';
  itemIndex: number;
  generatedText: string;
  citedPages: number[];
  sourceTextSnippet: string;
  status: EvaluationStatus;
  reviewer: string | null;
  reviewerNotes: string;
}

export interface EvaluationReportData {
  timestamp: string;
  nodeVersion: string;
  gitCommit: string;
  mode: 'mock' | 'live';
  providerName: string;
  modelName: string;
  promptVersion: string;
  totalProviderCalls: number;
  maxCallsLimit?: number;
  validDocumentsTarget: number;
  validDocumentsProcessed: number;
  negativeFixturesTarget: number;
  negativeFixturesProcessed: number;
  overallVerdict: 'PASS_MOCK' | 'PASS_LIVE' | 'FAIL';
  summaryMetrics: {
    validDocumentsPassCount: number;
    validDocumentsFailCount: number;
    negativeFixturesPassCount: number;
    negativeFixturesFailCount: number;
    totalQuizQuestionsEvaluated: number;
    quizQuestionsStructurallyValid: number;
    quizQuestionsFactualAccuracyReviewed: number;
    quizQuestionsFactualAccuracyPassed: number;
    invalidPageReferencesCount: number;
    unreviewedCriteriaCount: number;
  };
  validDocuments: DocumentEvaluationResult[];
  negativeFixtures: NegativeFixtureResult[];
  manualReviewItems: ManualReviewItem[];
}

// ============================================================================
// Budget-Enforced Provider Adapter Wrapper (Live Mode Safety)
// ============================================================================

export class BudgetTrackedAdapter implements AiProviderAdapter {
  private baseAdapter: AiProviderAdapter;
  private callCount = 0;
  private maxCalls: number;

  constructor(baseAdapter: AiProviderAdapter, maxCalls: number) {
    this.baseAdapter = baseAdapter;
    this.maxCalls = maxCalls;
  }

  getCallCount(): number {
    return this.callCount;
  }

  getMaxCalls(): number {
    return this.maxCalls;
  }

  private assertBudget(): void {
    if (this.callCount >= this.maxCalls) {
      throw new AiProviderError(
        'AI_BUDGET_EXCEEDED',
        `Batas maksimum panggilan AI (${this.maxCalls}) tercapai. Evaluasi dihentikan demi keamanan kuota dan biaya.`,
        false,
        undefined,
        429
      );
    }
  }

  async generateSummary(
    input: AiSummaryInput,
    options?: { timeoutMs?: number; jobId?: string }
  ): Promise<AiSummaryResult> {
    this.assertBudget();
    this.callCount++;
    return this.baseAdapter.generateSummary(input, options);
  }

  async generateFlashcards(
    input: AiFlashcardInput,
    options?: { timeoutMs?: number; jobId?: string }
  ): Promise<AiFlashcardResult> {
    this.assertBudget();
    this.callCount++;
    return this.baseAdapter.generateFlashcards(input, options);
  }

  async generateQuiz(
    input: AiQuizInput,
    options?: { timeoutMs?: number; jobId?: string }
  ): Promise<AiQuizResult> {
    this.assertBudget();
    this.callCount++;
    return this.baseAdapter.generateQuiz(input, options);
  }
}

// ============================================================================
// CLI Argument Parsing & Validation
// ============================================================================

export function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    provider: 'mock',
    negativeOnly: false,
    validOnly: false,
    manifestPath: 'docs/ai_evaluation/manifest.json',
  };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--negative-only') {
      options.negativeOnly = true;
      continue;
    }

    if (arg === '--valid-only') {
      options.validOnly = true;
      continue;
    }

    if (arg.startsWith('--provider=')) {
      const val = arg.split('=')[1]?.trim().toLowerCase();
      if (val !== 'mock' && val !== 'gemini') {
        throw new CliArgumentError(
          `Penyedia AI "${val}" tidak didukung. Opsi yang valid: "mock", "gemini".`
        );
      }
      options.provider = val as 'mock' | 'gemini';
      continue;
    }

    if (arg.startsWith('--limit=')) {
      const raw = arg.split('=')[1]?.trim();
      const num = Number(raw);
      if (!raw || isNaN(num) || !Number.isInteger(num) || num <= 0) {
        throw new CliArgumentError(
          `Argumen --limit harus berupa bilangan bulat positif (diterima: "${raw}").`
        );
      }
      options.limit = num;
      continue;
    }

    if (arg.startsWith('--max-calls=')) {
      const raw = arg.split('=')[1]?.trim();
      const num = Number(raw);
      if (!raw || isNaN(num) || !Number.isInteger(num) || num <= 0) {
        throw new CliArgumentError(
          `Argumen --max-calls harus berupa bilangan bulat positif (diterima: "${raw}").`
        );
      }
      options.maxCalls = num;
      continue;
    }

    if (arg.startsWith('--manifest=')) {
      const pathVal = arg.split('=')[1]?.trim();
      if (!pathVal) {
        throw new CliArgumentError('Argumen --manifest memerlukan path file.');
      }
      options.manifestPath = pathVal;
      continue;
    }

    if (arg.startsWith('--output=')) {
      const pathVal = arg.split('=')[1]?.trim();
      if (!pathVal) {
        throw new CliArgumentError('Argumen --output memerlukan path file.');
      }
      options.outputPath = pathVal;
      continue;
    }

    // Unrecognized argument
    throw new CliArgumentError(
      `Opsi CLI tidak didukung: "${arg}". Jalankan dengan --help untuk melihat panduan penggunaan.`
    );
  }

  if (options.negativeOnly && options.validOnly) {
    throw new CliArgumentError(
      'Opsi --negative-only dan --valid-only tidak dapat digunakan secara bersamaan.'
    );
  }

  return options;
}

export function printUsageGuide(): void {
  console.log(`
StudyFlow AI Evaluation Benchmark Runner
========================================
Penggunaan:
  npm run eval:ai [opsi]
  npx tsx scripts/run-ai-evaluation.ts [opsi]

Opsi yang Didukung:
  --provider=<mock|gemini>   Pilih provider model AI (default: "mock").
                             "mock": Pengujian integrasi skema & struktur deterministik (tanpa kuota/biaya).
                             "gemini": Pengujian provider langsung (memerlukan GEMINI_API_KEY).
  --limit=<N>                Batasi evaluasi pada N dokumen valid pertama (contoh: --limit=5).
  --max-calls=<N>            Batas maksimum panggilan AI pada mode live untuk perlindungan budget.
  --negative-only            Hanya jalankan pengujian fixture negatif (file rusak, scan, dll.).
  --valid-only               Hanya jalankan pengujian dokumen PDF valid.
  --manifest=<path>          Tentukan manifest evaluasi kustom (default: docs/ai_evaluation/manifest.json).
  --output=<path>            Tentukan lokasi penyimpanan berkas laporan Markdown kustom.
  --help, -h                 Tampilkan panduan penggunaan ini.

Tiga Lapisan Evaluasi:
  1. Validasi Dokumen & Ekstraksi : Magic bytes, teks riil, batas halaman, & penolakan kasus negatif.
  2. Integrasi Skema & Format AI   : Validasi skema Zod, bounds rujukan halaman, & struktur kuis 4-opsi.
  3. Kualitas Faktual & Review     : Verifikasi klaim terhadap teks sumber nyata (review manual).
`);
}

// ============================================================================
// Layer 1: Evaluasi Fixture Negatif
// ============================================================================

export async function evaluateNegativeFixture(
  fix: NegativeFixtureItem,
  fixtureDir: string
): Promise<NegativeFixtureResult> {
  const filePath = path.resolve(fixtureDir, fix.filename);
  if (!fs.existsSync(filePath)) {
    return {
      id: fix.id,
      filename: fix.filename,
      category: fix.category,
      expectedError: fix.expectedError,
      status: 'FAIL',
      detail: `Berkas fixture negatif tidak ditemukan di: ${filePath}`,
    };
  }

  const buffer = fs.readFileSync(filePath);

  // Special note on simulated encryption
  const isSimulatedEncryption = fix.filename.includes('sim') || fix.id.includes('sim');

  try {
    const extracted = await extractPdfText(buffer);

    // Prompt injection: extraction layer test
    if (fix.category === 'PROMPT_INJECTION') {
      const text = extracted.pages.map((p) => p.text).join(' ');
      const containsAttack = text.includes('SYSTEM INSTRUCTION');
      if (containsAttack) {
        return {
          id: fix.id,
          filename: fix.filename,
          category: fix.category,
          status: 'PASS',
          detail:
            'Teks instruksi berbahaya diekstrak sebagai konten mentah biasa tanpa menyebabkan parser crash. (Catatan: Ketahanan model terhadap instruksi dievaluasi pada Layer 2/3).',
        };
      }
      return {
        id: fix.id,
        filename: fix.filename,
        category: fix.category,
        status: 'FAIL',
        detail: 'Teks prompt injection tidak ditemukan pada hasil ekstraksi.',
      };
    }

    // Other negative fixtures must throw errors!
    return {
      id: fix.id,
      filename: fix.filename,
      category: fix.category,
      expectedError: fix.expectedError,
      status: 'FAIL',
      detail: `Berkas seharusnya ditolak dengan error "${fix.expectedError}", namun berhasil diekstrak (${extracted.pages.length} halaman).`,
      isSimulatedWarning: isSimulatedEncryption,
    };
  } catch (err: unknown) {
    const pdfErr = err as PdfValidationError;
    const actualCode = pdfErr.code || (err instanceof Error ? err.name : 'UNKNOWN_ERROR');

    if (fix.expectedError && (actualCode === fix.expectedError || (fix.expectedError === 'FILE_CORRUPTED' && actualCode === 'INVALID_FILE_SIGNATURE'))) {
      return {
        id: fix.id,
        filename: fix.filename,
        category: fix.category,
        expectedError: fix.expectedError,
        status: 'PASS',
        detail: `Ditolak sesuai kriteria: ${actualCode} — ${pdfErr.message || String(err)}`,
        isSimulatedWarning: isSimulatedEncryption,
      };
    }

    return {
      id: fix.id,
      filename: fix.filename,
      category: fix.category,
      expectedError: fix.expectedError,
      status: 'FAIL',
      detail: `Kode kesalahan tidak cocok (diharapkan "${fix.expectedError}", diterima "${actualCode}")`,
      isSimulatedWarning: isSimulatedEncryption,
    };
  }
}

// ============================================================================
// Layer 1 & 2: Evaluasi Dokumen Valid
// ============================================================================

export async function evaluateDocument(
  doc: ManifestItem,
  fixtureDir: string,
  adapter: AiProviderAdapter,
  mode: 'mock' | 'live'
): Promise<DocumentEvaluationResult> {
  const filePath = path.resolve(fixtureDir, doc.filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Berkas dokumen valid tidak ditemukan di: ${filePath}`);
  }

  const buffer = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const sizeBytes = buffer.length;

  // 1. Layer 1: PDF Text Extraction
  let extracted;
  try {
    extracted = await extractPdfText(buffer);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      id: doc.id,
      filename: doc.filename,
      language: doc.language,
      fileHashSha256: hash,
      fileSizeBytes: sizeBytes,
      expectedPageCount: doc.pageCount,
      extractedPageCount: 0,
      extractedCharacters: 0,
      overallStatus: 'FAIL',
      criteria: {
        pdfExtraction: {
          name: 'Ekstraksi PDF',
          status: 'FAIL',
          detail: `Gagal mengekstrak teks PDF: ${errorMsg}`,
        },
        pageReferences: {
          name: 'Rujukan Halaman Valid (Provenance)',
          status: 'NOT_EVALUATED',
          detail: 'Dilewati karena ekstraksi PDF gagal.',
        },
        summarySchema: {
          name: 'Kesesuaian Skema Ringkasan (Zod)',
          status: 'NOT_EVALUATED',
          detail: 'Dilewati karena ekstraksi PDF gagal.',
        },
        flashcardSchema: {
          name: 'Kesesuaian Skema Flashcards (Zod)',
          status: 'NOT_EVALUATED',
          detail: 'Dilewati karena ekstraksi PDF gagal.',
        },
        quizStructuralValidity: {
          name: 'Validitas Struktur Format Kuis',
          status: 'NOT_EVALUATED',
          detail: 'Dilewati karena ekstraksi PDF gagal.',
        },
        quizAnswerKeyFactualAccuracy: {
          name: 'Akurasi Faktual Kunci Jawaban Kuis',
          status: 'NOT_EVALUATED',
          detail: 'Dilewati karena ekstraksi PDF gagal.',
        },
        modelPromptInjectionDefense: {
          name: 'Ketahanan Model Terhadap Prompt Injection',
          status: 'NOT_EVALUATED',
          detail: 'Dilewati karena ekstraksi PDF gagal.',
        },
      },
      sampleQuizQuestions: [],
    };
  }

  const totalChars = extracted.pages.reduce((acc, p) => acc + p.characterCount, 0);
  const extractionSuccess =
    extracted.pages.length === doc.pageCount && totalChars > 30;

  const extractionCriteria: CriteriaResult = {
    name: 'Ekstraksi PDF',
    status: extractionSuccess ? 'PASS' : 'FAIL',
    detail: extractionSuccess
      ? `Berhasil diekstrak (${extracted.pages.length} halaman, ${totalChars} karakter)`
      : `Ekstraksi tidak lengkap (diharapkan ${doc.pageCount} halaman, diterima ${extracted.pages.length})`,
  };

  const inputPages = extracted.pages.map((p) => ({
    pageNumber: p.pageNumber,
    text: p.text,
  }));

  // 2. Layer 2: Summary Generation & Schema
  let summarySchemaPassed = false;
  let summaryPageRefsValid = true;
  let summaryDetail = '';
  try {
    const summary = await adapter.generateSummary({
      materialTitle: doc.title,
      pages: inputPages,
      totalPages: extracted.pageCount,
    });

    const parsed = SummaryStructuredOutputSchema.safeParse(summary);
    if (!parsed.success) {
      summarySchemaPassed = false;
      summaryDetail = `Validasi Zod gagal: ${parsed.error.errors.map((e) => e.message).join(', ')}`;
    } else {
      summarySchemaPassed = true;
      summaryDetail = 'Memenuhi skema terstruktur Zod (title, overview, keyConcepts, sections, keyTerms)';
    }

    // Check page references within bounds [1, totalPages]
    for (const c of summary.keyConcepts || []) {
      for (const ref of c.pageReferences || []) {
        if (ref < 1 || ref > extracted.pageCount) {
          summaryPageRefsValid = false;
        }
      }
    }
    for (const s of summary.sections || []) {
      for (const ref of s.pageReferences || []) {
        if (ref < 1 || ref > extracted.pageCount) {
          summaryPageRefsValid = false;
        }
      }
    }
  } catch (err: unknown) {
    summarySchemaPassed = false;
    summaryDetail = `Eksekusi generator ringkasan gagal: ${err instanceof Error ? err.message : String(err)}`;
  }

  // 3. Layer 2: Flashcards Generation & Schema
  let flashcardSchemaPassed = false;
  let flashcardPageRefsValid = true;
  let flashcardDetail = '';
  try {
    const flashcards = await adapter.generateFlashcards({
      materialTitle: doc.title,
      pages: inputPages,
      totalPages: extracted.pageCount,
      targetCount: 5,
    });

    const parsed = FlashcardSetStructuredOutputSchema.safeParse(flashcards);
    if (!parsed.success) {
      flashcardSchemaPassed = false;
      flashcardDetail = `Validasi Zod gagal: ${parsed.error.errors.map((e) => e.message).join(', ')}`;
    } else {
      flashcardSchemaPassed = true;
      flashcardDetail = `Memenuhi skema terstruktur Zod (${flashcards.cards?.length || 0} kartu)`;
    }

    for (const card of flashcards.cards || []) {
      for (const ref of card.pageReferences || []) {
        if (ref < 1 || ref > extracted.pageCount) {
          flashcardPageRefsValid = false;
        }
      }
    }
  } catch (err: unknown) {
    flashcardSchemaPassed = false;
    flashcardDetail = `Eksekusi generator flashcards gagal: ${err instanceof Error ? err.message : String(err)}`;
  }

  // 4. Layer 2: Quiz Generation & Structural Validity
  let quizSchemaPassed = false;
  let quizPageRefsValid = true;
  let quizStructuralPassed = true;
  let quizStructuralDetail = '';
  const sampleQuizQuestions: DocumentEvaluationResult['sampleQuizQuestions'] = [];

  try {
    const quiz = await adapter.generateQuiz({
      materialTitle: doc.title,
      pages: inputPages,
      totalPages: extracted.pageCount,
      targetCount: 5,
    });

    const parsed = QuizStructuredOutputSchema.safeParse(quiz);
    if (!parsed.success) {
      quizSchemaPassed = false;
      quizStructuralPassed = false;
      quizStructuralDetail = `Validasi Zod gagal: ${parsed.error.errors.map((e) => e.message).join(', ')}`;
    } else {
      quizSchemaPassed = true;
    }

    for (const q of quiz.questions || []) {
      sampleQuizQuestions.push(q);

      // Provenance bounds
      if (!q.pageReferences || q.pageReferences.length === 0) {
        quizPageRefsValid = false;
      }
      for (const ref of q.pageReferences || []) {
        if (ref < 1 || ref > extracted.pageCount) {
          quizPageRefsValid = false;
        }
      }

      // 4 options requirement
      if (!q.options || q.options.length !== 4) {
        quizStructuralPassed = false;
      }

      // Distinct options requirement (no duplicates)
      const uniqueOptions = new Set((q.options || []).map((o) => o.trim().toLowerCase()));
      if (uniqueOptions.size !== 4) {
        quizStructuralPassed = false;
      }

      // Valid correctIndex bounds [0..3]
      if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex > 3) {
        quizStructuralPassed = false;
      }

      // Explanation present
      if (!q.explanation || q.explanation.trim().length === 0) {
        quizStructuralPassed = false;
      }
    }

    if (quizStructuralPassed && quizSchemaPassed) {
      quizStructuralDetail = `Struktur format valid (${quiz.questions?.length || 0} soal): tepat 4 opsi unik, indeks 0..3, ada pembahasan, & rujukan halaman valid`;
    } else if (!quizStructuralDetail) {
      quizStructuralDetail = 'Struktur format kuis tidak memenuhi kriteria PRD (opsi tidak tepat 4, duplikasi opsi, atau indeks salah)';
    }
  } catch (err: unknown) {
    quizSchemaPassed = false;
    quizStructuralPassed = false;
    quizStructuralDetail = `Eksekusi generator kuis gagal: ${err instanceof Error ? err.message : String(err)}`;
  }

  const allPageRefsValid = summaryPageRefsValid && flashcardPageRefsValid && quizPageRefsValid;

  // 5. Layer 3: Factual Quality & Prompt Injection Behavioral Resistance
  // In mock mode, factual accuracy and model prompt injection resistance CANNOT be evaluated
  const factualAccuracyCriteria: CriteriaResult = {
    name: 'Akurasi Faktual Kunci Jawaban Kuis',
    status: 'NOT_EVALUATED',
    detail:
      mode === 'mock'
        ? 'Mode mock hanya memvalidasi struktur format; akurasi faktual terhadap teks sumber memerlukan evaluasi model riil & review manual.'
        : 'Menunggu review manual terhadap teks sumber.',
  };

  const modelPromptInjectionCriteria: CriteriaResult = {
    name: 'Ketahanan Model Terhadap Prompt Injection',
    status: 'NOT_EVALUATED',
    detail:
      mode === 'mock'
        ? 'Mode mock menghasilkan keluaran deterministik; perilaku model terhadap instruksi jahat tidak dievaluasi oleh mock adapter.'
        : 'Menunggu evaluasi adversarial live.',
  };

  const structuralPass =
    extractionSuccess &&
    summarySchemaPassed &&
    flashcardSchemaPassed &&
    quizStructuralPassed &&
    allPageRefsValid;

  return {
    id: doc.id,
    filename: doc.filename,
    language: doc.language,
    fileHashSha256: hash,
    fileSizeBytes: sizeBytes,
    expectedPageCount: doc.pageCount,
    extractedPageCount: extracted.pageCount,
    extractedCharacters: totalChars,
    overallStatus: structuralPass ? 'PASS' : 'FAIL',
    criteria: {
      pdfExtraction: extractionCriteria,
      pageReferences: {
        name: 'Rujukan Halaman Valid (Provenance)',
        status: allPageRefsValid ? 'PASS' : 'FAIL',
        detail: allPageRefsValid
          ? 'Seluruh nomor halaman yang dirujuk berada dalam rentang [1..totalPages]'
          : 'Ditemukan nomor halaman yang berada di luar batas dokumen.',
      },
      summarySchema: {
        name: 'Kesesuaian Skema Ringkasan (Zod)',
        status: summarySchemaPassed ? 'PASS' : 'FAIL',
        detail: summaryDetail,
      },
      flashcardSchema: {
        name: 'Kesesuaian Skema Flashcards (Zod)',
        status: flashcardSchemaPassed ? 'PASS' : 'FAIL',
        detail: flashcardDetail,
      },
      quizStructuralValidity: {
        name: 'Validitas Struktur Format Kuis',
        status: quizStructuralPassed ? 'PASS' : 'FAIL',
        detail: quizStructuralDetail,
      },
      quizAnswerKeyFactualAccuracy: factualAccuracyCriteria,
      modelPromptInjectionDefense: modelPromptInjectionCriteria,
    },
    sampleQuizQuestions,
  };
}

// ============================================================================
// Report Formatter (Markdown)
// ============================================================================

export function generateEvaluationReport(data: EvaluationReportData): string {
  const isMock = data.mode === 'mock';
  const verdictBanner =
    data.overallVerdict === 'PASS_MOCK'
      ? '**PASS (MOCK STRUCTURAL & INTEGRATION ONLY)**'
      : data.overallVerdict === 'PASS_LIVE'
      ? '**PASS (LIVE EVALUATION VERIFIED)**'
      : '**FAIL (EVALUATION GATES FAILED)**';

  let report = `# Laporan Evaluasi AI & Benchmark Kualitas Dokumen — StudyFlow

| Metadata Evaluasi | Nilai |
| --- | --- |
| **Waktu Eksekusi** | ${data.timestamp} |
| **Node.js Runtime** | ${data.nodeVersion} |
| **Versi Kode (Git)** | \`${data.gitCommit}\` |
| **Mode Evaluasi** | \`${data.mode.toUpperCase()}\` |
| **Provider AI** | \`${data.providerName}\` |
| **Model AI** | \`${data.modelName}\` |
| **Versi Prompt** | \`${data.promptVersion}\` |
| **Panggilan Provider Dibuat** | ${data.totalProviderCalls}${data.maxCallsLimit ? ` (Batas budget: ${data.maxCallsLimit})` : ''} |
| **Sampel Dokumen Valid Diproses** | ${data.validDocumentsProcessed} dari ${data.validDocumentsTarget} berkas |
| **Fixture Negatif Diproses** | ${data.negativeFixturesProcessed} dari ${data.negativeFixturesTarget} berkas |
| **Status Keseluruhan** | ${verdictBanner} |

---

## 1. Pemisahan Tiga Lapisan Evaluasi

Sesuai instruksi PRD Bagian 15.2, evaluasi sistem dibagi menjadi 3 lapisan independen:

1. **Lapisan 1: Validasi Dokumen & Ekstraksi**
   Memverifikasi magic bytes (\`%PDF-\`), integritas struktur berkas, ekstraksi teks riil per halaman menggunakan \`pdfjs-dist\`, serta penolakan deterministik berkas negatif (scan tanpa teks, berkas rusak, berkas terenkripsi kata sandi, dan berkas melebihi 100 halaman).
2. **Lapisan 2: Integrasi & Validitas Struktur Output AI**
   Memverifikasi keluaran model terhadap skema kontrak Zod publik aplikasi (\`SummaryStructuredOutputSchema\`, \`FlashcardSetStructuredOutputSchema\`, \`QuizStructuredOutputSchema\`), validitas batas provenance (\`1 <= pageReference <= totalPages\`), ketiadaan duplikasi opsi kuis, serta keabsahan indeks jawaban (\`0..3\`).
   > *Peringatan Integritas*: Kelulusan lapisan struktur format kuis **TIDAK SAMA** dengan akurasi kebenaran faktual materi.
3. **Lapisan 3: Kualitas Faktual & Penilaian Manual**
   Verifikasi kesesuaian klaim ringkasan, relevansi kartu latihan, dan kebenaran kunci jawaban kuis terhadap teks sumber nyata.
   > *Status Mode Mock*: Seluruh kriteria Layer 3 berstatus **\`NOT_EVALUATED\`** pada mode mock. Keberhasilan mock tidak pernah dijadikan klaim akurasi faktual provider nyata.

---

## 2. Hasil Evaluasi Fixture Negatif (Lapisan 1)

| ID Fixture | Kategori | Perilaku yang Diharapkan | Status | Keterangan Hasil |
| --- | --- | --- | :---: | --- |
${data.negativeFixtures
  .map(
    (r) =>
      `| \`${r.id}\` | ${r.category} | ${r.expectedError || r.expectedBehavior || 'Sesuai PRD'} | **${r.status}** | ${r.detail} |`
  )
  .join('\n')}

> **Catatan Audit Fixture Terenkripsi**: Fixture simulasi berbasis teks biasa (seperti \`neg-02-encrypted-sim.pdf\`) tidak memiliki dictionary \`/Encrypt\` PDF dan tidak membuktikan penolakan enkripsi oleh parser. Penolakan hanya terbukti sah pada berkas dengan struktur keamanan terenkripsi aktif (\`negative-encrypted.pdf\`) yang ditolak dengan kode \`FILE_ENCRYPTED\`.

---

## 3. Hasil Evaluasi Dokumen Valid (${data.validDocumentsProcessed} Dokumen Diproses)

| No | ID Dokumen | Bahasa | Hlm | Ekstraksi | Rujukan Hlm | Skema Zod | Struktur Kuis | Akurasi Faktual | Status |
| :-: | --- | :-: | :-: | :---: | :---: | :---: | :---: | :---: | :---: |
${data.validDocuments
  .map(
    (d, idx) =>
      `| ${idx + 1} | \`${d.id}\` | ${d.language.toUpperCase()} | ${d.extractedPageCount} | **${d.criteria.pdfExtraction.status}** | **${d.criteria.pageReferences.status}** | **${d.criteria.summarySchema.status === 'PASS' && d.criteria.flashcardSchema.status === 'PASS' ? 'PASS' : 'FAIL'}** | **${d.criteria.quizStructuralValidity.status}** | *${d.criteria.quizAnswerKeyFactualAccuracy.status}* | **${d.overallStatus}** |`
  )
  .join('\n')}

---

## 4. Ringkasan Metrik & Quality Gates PRD

- **Dokumen Valid Lulus Uji Struktur & Skema:** ${data.summaryMetrics.validDocumentsPassCount}/${data.validDocumentsProcessed} (${data.validDocumentsProcessed > 0 ? ((data.summaryMetrics.validDocumentsPassCount / data.validDocumentsProcessed) * 100).toFixed(1) : 0}%)
- **Fixture Negatif Ditangani Sesuai Spesifikasi:** ${data.summaryMetrics.negativeFixturesPassCount}/${data.negativeFixturesProcessed}
- **Total Butir Soal Kuis Diuji Strukturnya:** ${data.summaryMetrics.totalQuizQuestionsEvaluated} butir
- **Soal Kuis dengan Format Struktur Valid (4 opsi unik, indeks 0..3):** ${data.summaryMetrics.quizQuestionsStructurallyValid} butir (${data.summaryMetrics.totalQuizQuestionsEvaluated > 0 ? ((data.summaryMetrics.quizQuestionsStructurallyValid / data.summaryMetrics.totalQuizQuestionsEvaluated) * 100).toFixed(1) : 0}%)
- **Rujukan Halaman di Luar Batas (Invalid Page References):** ${data.summaryMetrics.invalidPageReferencesCount} rujukan (Gate PRD: tepat 0 rujukan)
- **Kriteria yang Belum Dinilai (NOT_EVALUATED):** ${data.summaryMetrics.unreviewedCriteriaCount} kriteria
  - Akurasi faktual kunci jawaban kuis: **NOT_EVALUATED** (mewajibkan review manual terhadap sumber)
  - Kesetiaan ringkasan materi terhadap sumber: **NOT_EVALUATED**
  - Ketahanan perilaku model terhadap prompt injection: **NOT_EVALUATED** (${isMock ? 'Mock adapter tidak mengeksekusi prompt LLM' : 'Menunggu uji adversarial'})

---

## 5. Format Audit & Lembar Penilaian Manual (Lapisan 3)

Berikut adalah sampel butir keluaran konkret beserta cuplikan teks sumber dari halaman yang dirujuk untuk keperluan audit manual manusia:

| ID Dokumen | Jenis | Nomor Soal / Kartu | Pertanyaan / Konsep | Halaman Rujukan | Cuplikan Teks Sumber | Status Review |
| --- | :-: | :-: | --- | :-: | --- | :---: |
${data.manualReviewItems
  .slice(0, 10)
  .map(
    (item) =>
      `| \`${item.docId}\` | ${item.category} | #${item.itemIndex} | ${item.generatedText.replace(/\|/g, '-').slice(0, 60)}... | Hlm ${item.citedPages.join(', ')} | "${item.sourceTextSnippet.replace(/\|/g, '-').slice(0, 60)}..." | **${item.status}** |`
  )
  .join('\n')}

---

## 6. Pernyataan Pertanggungjawaban & Batasan

1. **Koreksi Terhadap Laporan Masa Lalu**:
   Laporan evaluasi sebelumnya menyatakan akurasi kuis 100% dan penolakan prompt injection berhasil, namun hasil tersebut hanya mencerminkan pengujian struktur keluaran template mock dan penemuan teks serangan pada ekstraksi. Laporan saat ini memisahkan secara tegas antara keabsahan format sintaksis (Layer 2) dan kebenaran faktual materi (Layer 3).
2. **Kondisi Pengujian Live**:
   Pengujian live provider (\`--provider=gemini\`) memerlukan konfigurasi kunci API dan dibatasi secara ketat oleh pembatas kuota \`BudgetTrackedAdapter\` guna mencegah pembengkakan biaya.
`;

  return report;
}

// ============================================================================
// Core Evaluation Orchestrator
// ============================================================================

export async function runAiEvaluation(
  options: CliOptions
): Promise<{ success: boolean; reportData: EvaluationReportData; reportMarkdown: string }> {
  const isMock = options.provider === 'mock';
  const manifestFullPath = path.resolve(options.manifestPath);

  if (!fs.existsSync(manifestFullPath)) {
    throw new Error(`Berkas manifest tidak ditemukan pada path: ${manifestFullPath}`);
  }

  const manifest: Manifest = JSON.parse(fs.readFileSync(manifestFullPath, 'utf-8'));
  const fixtureBaseDir = path.dirname(manifestFullPath);
  const validFixtureDir = path.resolve(fixtureBaseDir, 'fixtures/valid');
  const negativeFixtureDir = path.resolve(fixtureBaseDir, 'fixtures/negative');

  // Setup Provider Adapter with safety wrappers
  let baseAdapter: AiProviderAdapter;
  let trackedAdapter: BudgetTrackedAdapter;

  if (isMock) {
    baseAdapter = new MockAiProviderAdapter();
    trackedAdapter = new BudgetTrackedAdapter(baseAdapter, options.maxCalls || 1000);
  } else {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Kredensial GEMINI_API_KEY tidak ditemukan di environment. Evaluasi live provider dibatalkan.'
      );
    }
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    baseAdapter = new GeminiAiProviderAdapter(apiKey, model);
    trackedAdapter = new BudgetTrackedAdapter(baseAdapter, options.maxCalls || 15);
  }

  // 1. Evaluate Negative Fixtures (if not --valid-only)
  const negativeResults: NegativeFixtureResult[] = [];
  if (!options.validOnly) {
    console.log(`\n1. Menguji ${manifest.negativeFixtures.length} Fixture Negatif (Lapisan 1: Ekstraksi & Validasi Dokumen)...`);
    for (const fix of manifest.negativeFixtures) {
      const res = await evaluateNegativeFixture(fix, negativeFixtureDir);
      negativeResults.push(res);
      console.log(`  [${res.status}] ${res.id}: ${res.detail}`);
    }
  }

  // 2. Evaluate Valid Documents (if not --negative-only)
  const validResults: DocumentEvaluationResult[] = [];
  const manualReviewItems: ManualReviewItem[] = [];

  const validTargetList = options.negativeOnly
    ? []
    : options.limit
    ? manifest.validDocuments.slice(0, options.limit)
    : manifest.validDocuments;

  if (!options.negativeOnly) {
    console.log(
      `\n2. Menguji ${validTargetList.length} Dokumen Valid (${options.provider.toUpperCase()} Provider, Lapisan 1 & 2)...`
    );

    for (let i = 0; i < validTargetList.length; i++) {
      const doc = validTargetList[i]!;
      const docResult = await evaluateDocument(
        doc,
        validFixtureDir,
        trackedAdapter,
        options.provider
      );
      validResults.push(docResult);

      console.log(
        `  [${docResult.overallStatus}] #${i + 1} ${doc.filename} (${doc.language.toUpperCase()}, ${docResult.extractedPageCount} hlm, ${docResult.extractedCharacters} kar) - Struktur Kuis: ${docResult.criteria.quizStructuralValidity.status}, Akurasi Faktual: ${docResult.criteria.quizAnswerKeyFactualAccuracy.status}`
      );

      // Create concrete sample review slots
      if (docResult.sampleQuizQuestions.length > 0) {
        const firstQ = docResult.sampleQuizQuestions[0]!;
        manualReviewItems.push({
          docId: doc.id,
          docTitle: doc.title,
          category: 'quiz',
          itemIndex: 1,
          generatedText: `${firstQ.question} (Kunci: Opsi ${firstQ.correctIndex + 1})`,
          citedPages: firstQ.pageReferences,
          sourceTextSnippet: `Halaman ${firstQ.pageReferences.join(', ')} dari dokumen ${doc.title}`,
          status: 'NOT_EVALUATED',
          reviewer: null,
          reviewerNotes: 'Menunggu audit kesesuaian jawaban terhadap naskah akademik sumber.',
        });
      }
    }
  }

  // 3. Compute Summary Metrics
  const negativePassCount = negativeResults.filter((r) => r.status === 'PASS').length;
  const negativeFailCount = negativeResults.filter((r) => r.status === 'FAIL').length;

  const validPassCount = validResults.filter((r) => r.overallStatus === 'PASS').length;
  const validFailCount = validResults.filter((r) => r.overallStatus === 'FAIL').length;

  let totalQuestionsCount = 0;
  let structurallyValidQuestionsCount = 0;
  let invalidPageRefsCount = 0;

  for (const docRes of validResults) {
    totalQuestionsCount += docRes.sampleQuizQuestions.length;
    if (docRes.criteria.quizStructuralValidity.status === 'PASS') {
      structurallyValidQuestionsCount += docRes.sampleQuizQuestions.length;
    }
    if (docRes.criteria.pageReferences.status === 'FAIL') {
      invalidPageRefsCount++;
    }
  }

  // Count unreviewed criteria
  let unreviewedCount = 0;
  for (const docRes of validResults) {
    if (docRes.criteria.quizAnswerKeyFactualAccuracy.status === 'NOT_EVALUATED') unreviewedCount++;
    if (docRes.criteria.modelPromptInjectionDefense.status === 'NOT_EVALUATED') unreviewedCount++;
  }

  let gitCommit = 'unknown';
  try {
    gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    gitCommit = 'dev-workspace';
  }

  const mandatoryChecksPassed =
    negativeFailCount === 0 && validFailCount === 0 && invalidPageRefsCount === 0;

  const overallVerdict: EvaluationReportData['overallVerdict'] = mandatoryChecksPassed
    ? isMock
      ? 'PASS_MOCK'
      : 'PASS_LIVE'
    : 'FAIL';

  const reportData: EvaluationReportData = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    gitCommit,
    mode: options.provider,
    providerName: isMock ? 'MockAiProviderAdapter (Deterministik)' : 'GeminiAiProviderAdapter',
    modelName: isMock ? 'reference-mock-v1' : process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    promptVersion: 'v1 (Summary, Flashcard, Quiz)',
    totalProviderCalls: trackedAdapter.getCallCount(),
    maxCallsLimit: trackedAdapter.getMaxCalls(),
    validDocumentsTarget: manifest.validDocuments.length,
    validDocumentsProcessed: validResults.length,
    negativeFixturesTarget: manifest.negativeFixtures.length,
    negativeFixturesProcessed: negativeResults.length,
    overallVerdict,
    summaryMetrics: {
      validDocumentsPassCount: validPassCount,
      validDocumentsFailCount: validFailCount,
      negativeFixturesPassCount: negativePassCount,
      negativeFixturesFailCount: negativeFailCount,
      totalQuizQuestionsEvaluated: totalQuestionsCount,
      quizQuestionsStructurallyValid: structurallyValidQuestionsCount,
      quizQuestionsFactualAccuracyReviewed: 0,
      quizQuestionsFactualAccuracyPassed: 0,
      invalidPageReferencesCount: invalidPageRefsCount,
      unreviewedCriteriaCount: unreviewedCount,
    },
    validDocuments: validResults,
    negativeFixtures: negativeResults,
    manualReviewItems,
  };

  const reportMarkdown = generateEvaluationReport(reportData);

  // Write Markdown Report
  const targetReportPath = options.outputPath
    ? path.resolve(options.outputPath)
    : path.resolve(fixtureBaseDir, 'evaluation_report.md');

  fs.mkdirSync(path.dirname(targetReportPath), { recursive: true });
  fs.writeFileSync(targetReportPath, reportMarkdown, 'utf-8');

  // Write JSON Results for audit trail
  const safeTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const jsonPath = path.resolve(fixtureBaseDir, `results-${safeTimestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(reportData, null, 2), 'utf-8');

  console.log('\n======================================================');
  console.log(`Evaluasi Selesai: Verdict ${overallVerdict}`);
  console.log(`- Dokumen Valid Lolos Struktur: ${validPassCount}/${validResults.length}`);
  console.log(`- Fixture Negatif Lolos Penolakan: ${negativePassCount}/${negativeResults.length}`);
  console.log(`- Soal Kuis Format Valid: ${structurallyValidQuestionsCount}/${totalQuestionsCount}`);
  console.log(`- Rujukan Halaman Invalid: ${invalidPageRefsCount}`);
  console.log(`- Kriteria Belum Dinilai (NOT_EVALUATED): ${unreviewedCount}`);
  console.log(`\nLaporan Markdown ditulis ke: ${targetReportPath}`);
  console.log(`Data Audit JSON ditulis ke: ${jsonPath}`);
  console.log('======================================================');

  return {
    success: mandatoryChecksPassed,
    reportData,
    reportMarkdown,
  };
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main() {
  try {
    const options = parseCliArgs(process.argv.slice(2));

    if (options.help) {
      printUsageGuide();
      process.exit(0);
    }

    const { success } = await runAiEvaluation(options);
    if (!success) {
      console.error('\n[FATAL] Satu atau lebih pemeriksaan wajib gagal. Evaluasi berakhir dengan exit code 1.');
      process.exit(1);
    }

    process.exit(0);
  } catch (err: unknown) {
    if (err instanceof CliArgumentError) {
      console.error(`\n[ERROR CLI] ${err.message}`);
      process.exit(1);
    }
    console.error(`\n[FATAL] Terjadi kesalahan tak terduga selama evaluasi: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

// Auto-run if executed directly via CLI
if (
  process.argv[1] &&
  (process.argv[1].endsWith('run-ai-evaluation.ts') ||
    process.argv[1].endsWith('run-ai-evaluation.js') ||
    process.argv[1].includes('run-ai-evaluation'))
) {
  main();
}
