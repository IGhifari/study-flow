import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@studyflow/database';
import { Job } from 'bullmq';
import {
  processAiSummaryJob,
  AiSummaryJobData,
  decrementActiveJobsCount,
} from '../queues/aiQueue.js';
import {
  MockAiProviderAdapter,
  setAiProviderAdapterForTesting,
} from '../services/aiProvider.js';

describe('Worker AI Summary Queue Processing', () => {
  let mockAdapter: MockAiProviderAdapter;
  let testUserId: string;
  let testCourseId: string;
  let testSemesterId: string;

  beforeEach(async () => {
    mockAdapter = new MockAiProviderAdapter();
    setAiProviderAdapterForTesting(mockAdapter);

    // Clean up test data
    await prisma.user.deleteMany({
      where: { email: { contains: 'worker.ai.test' } },
    });

    const user = await prisma.user.create({
      data: {
        email: `worker.ai.test.${Date.now()}@example.com`,
        passwordHash: 'hashed_password_placeholder',
        name: 'AI Worker Test User',
      },
    });
    testUserId = user.id;

    const semester = await prisma.semester.create({
      data: {
        userId: testUserId,
        name: 'Semester Test AI',
        academicYear: '2026/2027',
      },
    });
    testSemesterId = semester.id;

    const course = await prisma.course.create({
      data: {
        userId: testUserId,
        semesterId: testSemesterId,
        name: 'Kecerdasan Buatan',
        code: 'CS301',
      },
    });
    testCourseId = course.id;
  });

  it('should successfully generate summary for READY material with text', async () => {
    // 1. Create READY material with 2 pages of extracted text
    const material = await prisma.material.create({
      data: {
        userId: testUserId,
        courseId: testCourseId,
        title: 'Pengantar Sistem Terdistribusi',
        originalFilename: 'distributed-systems.pdf',
        storageKey: `materials/${testUserId}/test-1.pdf`,
        mimeType: 'application/pdf',
        bytes: 10240,
        pageCount: 2,
        status: 'READY',
      },
    });

    await prisma.materialPage.createMany({
      data: [
        {
          materialId: material.id,
          pageNumber: 1,
          extractedText:
            'Sistem terdistribusi adalah sekumpulan komputer independen yang tampak bagi pengguna sebagai satu kesatuan sistem.',
          characterCount: 110,
        },
        {
          materialId: material.id,
          pageNumber: 2,
          extractedText:
            'Karakteristik penting meliputi konkurensi, tidak adanya jam global, dan kegagalan independen.',
          characterCount: 92,
        },
      ],
    });

    // 2. Create AiUsage and initialize activeJobsCount = 1
    await prisma.aiUsage.create({
      data: {
        userId: testUserId,
        dailyGenerationCount: 1,
        activeJobsCount: 1,
      },
    });

    // 3. Create ProcessingJob & MaterialSummary in QUEUED status
    const procJob = await prisma.processingJob.create({
      data: {
        userId: testUserId,
        materialId: material.id,
        type: 'AI_SUMMARY_GENERATION',
        status: 'PENDING',
      },
    });

    const summary = await prisma.materialSummary.create({
      data: {
        userId: testUserId,
        materialId: material.id,
        status: 'QUEUED',
        activeJobId: procJob.id,
        provider: 'mock',
        model: 'mock-model',
        sourcePageCount: 2,
        sourceCharacterCount: 202,
      },
    });

    const jobData: AiSummaryJobData = {
      jobId: procJob.id,
      summaryId: summary.id,
      materialId: material.id,
      userId: testUserId,
      isRegeneration: false,
    };

    const mockJob = {
      id: procJob.id,
      data: jobData,
    } as unknown as Job<AiSummaryJobData>;

    // 4. Run worker processor
    const result = await processAiSummaryJob(mockJob);

    expect(result.status).toBe('READY');

    // 5. Verify database updates
    const updatedSummary = await prisma.materialSummary.findUnique({
      where: { id: summary.id },
    });
    expect(updatedSummary?.status).toBe('READY');
    expect(updatedSummary?.overview).toBeTruthy();
    expect(Array.isArray(updatedSummary?.keyConcepts)).toBe(true);
    expect(Array.isArray(updatedSummary?.sections)).toBe(true);
    expect(Array.isArray(updatedSummary?.keyTerms)).toBe(true);

    const updatedJob = await prisma.processingJob.findUnique({
      where: { id: procJob.id },
    });
    expect(updatedJob?.status).toBe('COMPLETED');

    const usage = await prisma.aiUsage.findUnique({
      where: { userId: testUserId },
    });
    expect(usage?.activeJobsCount).toBe(0);
  });

  it('should fail gracefully if material was deleted before worker processing', async () => {
    const material = await prisma.material.create({
      data: {
        userId: testUserId,
        courseId: testCourseId,
        title: 'Deleted Material',
        originalFilename: 'deleted.pdf',
        storageKey: `materials/${testUserId}/del.pdf`,
        mimeType: 'application/pdf',
        bytes: 5000,
        pageCount: 1,
        status: 'READY',
        deletedAt: new Date(), // Already deleted
      },
    });

    await prisma.aiUsage.create({
      data: {
        userId: testUserId,
        dailyGenerationCount: 1,
        activeJobsCount: 1,
      },
    });

    const procJob = await prisma.processingJob.create({
      data: {
        userId: testUserId,
        materialId: material.id,
        type: 'AI_SUMMARY_GENERATION',
        status: 'PENDING',
      },
    });

    const summary = await prisma.materialSummary.create({
      data: {
        userId: testUserId,
        materialId: material.id,
        status: 'QUEUED',
        activeJobId: procJob.id,
      },
    });

    const mockJob = {
      id: procJob.id,
      attemptsMade: 0,
      data: {
        jobId: procJob.id,
        summaryId: summary.id,
        materialId: material.id,
        userId: testUserId,
      },
    } as unknown as Job<AiSummaryJobData>;

    const result = await processAiSummaryJob(mockJob);
    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('MATERIAL_DELETED');

    // activeJobsCount is cleaned up
    const usage = await prisma.aiUsage.findUnique({
      where: { userId: testUserId },
    });
    expect(usage?.activeJobsCount).toBe(0);
  });

  it('should preserve previous successful summary if regeneration fails', async () => {
    // Setup material
    const material = await prisma.material.create({
      data: {
        userId: testUserId,
        courseId: testCourseId,
        title: 'Preserve Summary Material [TRIGGER_TIMEOUT]',
        originalFilename: 'preserve.pdf',
        storageKey: `materials/${testUserId}/preserve.pdf`,
        mimeType: 'application/pdf',
        bytes: 5000,
        pageCount: 1,
        status: 'READY',
      },
    });

    await prisma.materialPage.create({
      data: {
        materialId: material.id,
        pageNumber: 1,
        extractedText: 'Teks perkuliahan yang valid untuk pengujian regresi dan kegagalan regenerasi.',
        characterCount: 75,
      },
    });

    await prisma.aiUsage.create({
      data: {
        userId: testUserId,
        dailyGenerationCount: 1,
        activeJobsCount: 1,
      },
    });

    const procJob = await prisma.processingJob.create({
      data: {
        userId: testUserId,
        materialId: material.id,
        type: 'AI_SUMMARY_GENERATION',
        status: 'PENDING',
      },
    });

    // Existing ready summary
    const previousOverview = 'Ringkasan sukses sebelumnya yang harus tetap utuh.';
    const summary = await prisma.materialSummary.create({
      data: {
        userId: testUserId,
        materialId: material.id,
        status: 'QUEUED',
        title: 'Ringkasan Sebelumnya',
        overview: previousOverview,
        keyConcepts: [{ concept: 'Konsep A', explanation: 'Penjelasan A', pageReferences: [1] }],
        sections: [{ heading: 'Bab 1', content: 'Isi Bab 1', pageReferences: [1] }],
        keyTerms: [{ term: 'Term A', definition: 'Def A', pageReferences: [1] }],
        activeJobId: procJob.id,
      },
    });

    const mockJob = {
      id: procJob.id,
      attemptsMade: 2,
      opts: { attempts: 3 },
      data: {
        jobId: procJob.id,
        summaryId: summary.id,
        materialId: material.id,
        userId: testUserId,
        isRegeneration: true,
      },
    } as unknown as Job<AiSummaryJobData>;

    const result = await processAiSummaryJob(mockJob);
    expect(result.status).toBe('FAILED');

    // Verify summary status remains READY and previous overview/concepts are PRESERVED!
    const preserved = await prisma.materialSummary.findUnique({
      where: { id: summary.id },
    });
    expect(preserved?.status).toBe('READY');
    expect(preserved?.overview).toBe(previousOverview);
    expect(Array.isArray(preserved?.keyConcepts)).toBe(true);

    // Active jobs count decremented
    const usage = await prisma.aiUsage.findUnique({
      where: { userId: testUserId },
    });
    expect(usage?.activeJobsCount).toBe(0);
  });

  it('should process multi-chunk long document and merge sections deterministically', async () => {
    // Create a 25-page document with text spanning > 40,000 characters
    const material = await prisma.material.create({
      data: {
        userId: testUserId,
        courseId: testCourseId,
        title: 'Buku Ajar Jaringan Komputer Lanjut',
        originalFilename: 'computer-networks.pdf',
        storageKey: `materials/${testUserId}/networks.pdf`,
        mimeType: 'application/pdf',
        bytes: 80000,
        pageCount: 25,
        status: 'READY',
      },
    });

    const pageRecords = [];
    for (let p = 1; p <= 25; p++) {
      pageRecords.push({
        materialId: material.id,
        pageNumber: p,
        extractedText: `Bab ${p}: Pembahasan protokol jaringan, model OSI layer, enkapsulasi data, serta analisis routing pada internet skala besar. `.repeat(15),
        characterCount: 2000,
      });
    }
    await prisma.materialPage.createMany({ data: pageRecords });

    await prisma.aiUsage.create({
      data: {
        userId: testUserId,
        dailyGenerationCount: 1,
        activeJobsCount: 1,
      },
    });

    const procJob = await prisma.processingJob.create({
      data: {
        userId: testUserId,
        materialId: material.id,
        type: 'AI_SUMMARY_GENERATION',
        status: 'PENDING',
      },
    });

    const summary = await prisma.materialSummary.create({
      data: {
        userId: testUserId,
        materialId: material.id,
        status: 'QUEUED',
        activeJobId: procJob.id,
      },
    });

    const mockJob = {
      id: procJob.id,
      attemptsMade: 0,
      opts: { attempts: 3 },
      data: {
        jobId: procJob.id,
        summaryId: summary.id,
        materialId: material.id,
        userId: testUserId,
      },
    } as unknown as Job<AiSummaryJobData>;

    const result = await processAiSummaryJob(mockJob);
    expect(result.status).toBe('READY');

    const completedSummary = await prisma.materialSummary.findUnique({
      where: { id: summary.id },
    });
    expect(completedSummary?.status).toBe('READY');
    expect(completedSummary?.title).toContain('Ringkasan Komprehensif');
    expect(Array.isArray(completedSummary?.sections)).toBe(true);
    expect((completedSummary?.sections as any[]).length).toBeGreaterThan(1);

    const usage = await prisma.aiUsage.findUnique({ where: { userId: testUserId } });
    expect(usage?.activeJobsCount).toBe(0);
  });

  it('should reject document exceeding 100 pages with DOCUMENT_TOO_LARGE and release active job slot', async () => {
    const hugeMaterial = await prisma.material.create({
      data: {
        userId: testUserId,
        courseId: testCourseId,
        title: 'Materi Kuliah Sangat Panjang',
        originalFilename: 'huge.pdf',
        storageKey: `materials/${testUserId}/huge.pdf`,
        mimeType: 'application/pdf',
        bytes: 900000,
        pageCount: 105,
        status: 'READY',
      },
    });

    await prisma.materialPage.create({
      data: {
        materialId: hugeMaterial.id,
        pageNumber: 1,
        extractedText: 'Teks pengantar materi.',
        characterCount: 22,
      },
    });

    await prisma.aiUsage.create({
      data: {
        userId: testUserId,
        dailyGenerationCount: 1,
        activeJobsCount: 1,
      },
    });

    const procJob = await prisma.processingJob.create({
      data: {
        userId: testUserId,
        materialId: hugeMaterial.id,
        type: 'AI_SUMMARY_GENERATION',
        status: 'PENDING',
      },
    });

    const summary = await prisma.materialSummary.create({
      data: {
        userId: testUserId,
        materialId: hugeMaterial.id,
        status: 'QUEUED',
        activeJobId: procJob.id,
      },
    });

    const mockJob = {
      id: procJob.id,
      attemptsMade: 0,
      opts: { attempts: 3 },
      data: {
        jobId: procJob.id,
        summaryId: summary.id,
        materialId: hugeMaterial.id,
        userId: testUserId,
      },
    } as unknown as Job<AiSummaryJobData>;

    const result = await processAiSummaryJob(mockJob);
    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('DOCUMENT_TOO_LARGE');

    const failedJob = await prisma.processingJob.findUnique({ where: { id: procJob.id } });
    expect(failedJob?.status).toBe('FAILED');
    expect(failedJob?.errorCode).toBe('DOCUMENT_TOO_LARGE');

    const usage = await prisma.aiUsage.findUnique({ where: { userId: testUserId } });
    expect(usage?.activeJobsCount).toBe(0);
  });

  it('should safely abort and mark job FAILED if material was deleted before worker processing', async () => {
    const deletedMaterial = await prisma.material.create({
      data: {
        userId: testUserId,
        courseId: testCourseId,
        title: 'Materi Dihapus Pengguna',
        originalFilename: 'deleted.pdf',
        storageKey: `materials/${testUserId}/deleted.pdf`,
        mimeType: 'application/pdf',
        bytes: 10000,
        pageCount: 1,
        status: 'READY',
        deletedAt: new Date(), // Soft-deleted
      },
    });

    await prisma.aiUsage.create({
      data: {
        userId: testUserId,
        dailyGenerationCount: 1,
        activeJobsCount: 1,
      },
    });

    const procJob = await prisma.processingJob.create({
      data: {
        userId: testUserId,
        materialId: deletedMaterial.id,
        type: 'AI_SUMMARY_GENERATION',
        status: 'PENDING',
      },
    });

    const summary = await prisma.materialSummary.create({
      data: {
        userId: testUserId,
        materialId: deletedMaterial.id,
        status: 'QUEUED',
        activeJobId: procJob.id,
      },
    });

    const mockJob = {
      id: procJob.id,
      attemptsMade: 0,
      opts: { attempts: 3 },
      data: {
        jobId: procJob.id,
        summaryId: summary.id,
        materialId: deletedMaterial.id,
        userId: testUserId,
      },
    } as unknown as Job<AiSummaryJobData>;

    const result = await processAiSummaryJob(mockJob);
    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('MATERIAL_DELETED');

    const procJobInDb = await prisma.processingJob.findUnique({ where: { id: procJob.id } });
    expect(procJobInDb?.status).toBe('FAILED');
    expect(procJobInDb?.errorCode).toBe('MATERIAL_DELETED');

    const usage = await prisma.aiUsage.findUnique({ where: { userId: testUserId } });
    expect(usage?.activeJobsCount).toBe(0);
  });

  it('should handle AI_INVALID_OUTPUT detailing failing field and release slot on terminal failure', async () => {
    const material = await prisma.material.create({
      data: {
        userId: testUserId,
        courseId: testCourseId,
        title: 'Materi Uji Invalid Output [TRIGGER_INVALID_OUTPUT]',
        originalFilename: 'invalid.pdf',
        storageKey: `materials/${testUserId}/invalid.pdf`,
        mimeType: 'application/pdf',
        bytes: 5000,
        pageCount: 1,
        status: 'READY',
      },
    });

    await prisma.materialPage.create({
      data: {
        materialId: material.id,
        pageNumber: 1,
        extractedText: 'Teks perkuliahan yang valid untuk pengujian validasi skema keluaran.',
        characterCount: 68,
      },
    });

    await prisma.aiUsage.create({
      data: {
        userId: testUserId,
        dailyGenerationCount: 1,
        activeJobsCount: 1,
      },
    });

    const procJob = await prisma.processingJob.create({
      data: {
        userId: testUserId,
        materialId: material.id,
        type: 'AI_SUMMARY_GENERATION',
        status: 'PENDING',
      },
    });

    const summary = await prisma.materialSummary.create({
      data: {
        userId: testUserId,
        materialId: material.id,
        status: 'QUEUED',
        activeJobId: procJob.id,
      },
    });

    const mockJob = {
      id: procJob.id,
      attemptsMade: 2, // Last attempt -> terminal failure
      opts: { attempts: 3 },
      data: {
        jobId: procJob.id,
        summaryId: summary.id,
        materialId: material.id,
        userId: testUserId,
      },
    } as unknown as Job<AiSummaryJobData>;

    const result = await processAiSummaryJob(mockJob);
    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('AI_INVALID_OUTPUT');
    expect(result.error).toContain('title');
    expect(result.error).toContain('invalid_type');

    // DB summary updated
    const failedSummary = await prisma.materialSummary.findUnique({ where: { id: summary.id } });
    expect(failedSummary?.status).toBe('FAILED');
    expect(failedSummary?.errorCode).toBe('AI_INVALID_OUTPUT');
    expect(failedSummary?.errorMessage).toContain('title');

    // Active jobs count released
    const usage = await prisma.aiUsage.findUnique({ where: { userId: testUserId } });
    expect(usage?.activeJobsCount).toBe(0);
  });

  it('should handle AI_OUTPUT_TRUNCATED and release slot on terminal failure', async () => {
    const material = await prisma.material.create({
      data: {
        userId: testUserId,
        courseId: testCourseId,
        title: 'Materi Uji Terpotong [TRIGGER_OUTPUT_TRUNCATED]',
        originalFilename: 'truncated.pdf',
        storageKey: `materials/${testUserId}/truncated.pdf`,
        mimeType: 'application/pdf',
        bytes: 5000,
        pageCount: 1,
        status: 'READY',
      },
    });

    await prisma.materialPage.create({
      data: {
        materialId: material.id,
        pageNumber: 1,
        extractedText: 'Teks perkuliahan untuk pengujian batas token keluaran model.',
        characterCount: 60,
      },
    });

    await prisma.aiUsage.create({
      data: {
        userId: testUserId,
        dailyGenerationCount: 1,
        activeJobsCount: 1,
      },
    });

    const procJob = await prisma.processingJob.create({
      data: {
        userId: testUserId,
        materialId: material.id,
        type: 'AI_SUMMARY_GENERATION',
        status: 'PENDING',
      },
    });

    const summary = await prisma.materialSummary.create({
      data: {
        userId: testUserId,
        materialId: material.id,
        status: 'QUEUED',
        activeJobId: procJob.id,
      },
    });

    const mockJob = {
      id: procJob.id,
      attemptsMade: 2, // Last attempt -> terminal failure
      opts: { attempts: 3 },
      data: {
        jobId: procJob.id,
        summaryId: summary.id,
        materialId: material.id,
        userId: testUserId,
      },
    } as unknown as Job<AiSummaryJobData>;

    const result = await processAiSummaryJob(mockJob);
    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('AI_OUTPUT_TRUNCATED');

    const usage = await prisma.aiUsage.findUnique({ where: { userId: testUserId } });
    expect(usage?.activeJobsCount).toBe(0);
  });

  it('should immediately fail and release slot without retrying on AI_SAFETY_BLOCKED', async () => {
    const material = await prisma.material.create({
      data: {
        userId: testUserId,
        courseId: testCourseId,
        title: 'Materi Uji Filter Keamanan [TRIGGER_SAFETY_BLOCKED]',
        originalFilename: 'safety.pdf',
        storageKey: `materials/${testUserId}/safety.pdf`,
        mimeType: 'application/pdf',
        bytes: 5000,
        pageCount: 1,
        status: 'READY',
      },
    });

    await prisma.materialPage.create({
      data: {
        materialId: material.id,
        pageNumber: 1,
        extractedText: 'Teks perkuliahan yang memicu pemblokiran filter keamanan AI.',
        characterCount: 60,
      },
    });

    await prisma.aiUsage.create({
      data: {
        userId: testUserId,
        dailyGenerationCount: 1,
        activeJobsCount: 1,
      },
    });

    const procJob = await prisma.processingJob.create({
      data: {
        userId: testUserId,
        materialId: material.id,
        type: 'AI_SUMMARY_GENERATION',
        status: 'PENDING',
      },
    });

    const summary = await prisma.materialSummary.create({
      data: {
        userId: testUserId,
        materialId: material.id,
        status: 'QUEUED',
        activeJobId: procJob.id,
      },
    });

    const mockJob = {
      id: procJob.id,
      attemptsMade: 0, // First attempt -> non-retryable error fails immediately
      opts: { attempts: 3 },
      data: {
        jobId: procJob.id,
        summaryId: summary.id,
        materialId: material.id,
        userId: testUserId,
      },
    } as unknown as Job<AiSummaryJobData>;

    const result = await processAiSummaryJob(mockJob);
    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('AI_SAFETY_BLOCKED');

    const usage = await prisma.aiUsage.findUnique({ where: { userId: testUserId } });
    expect(usage?.activeJobsCount).toBe(0);
  });

  it('should reject document when a single page exceeds 40,000 characters and release slot', async () => {
    const material = await prisma.material.create({
      data: {
        userId: testUserId,
        courseId: testCourseId,
        title: 'Dokumen Satu Halaman Terlalu Besar',
        originalFilename: 'huge-single-page.pdf',
        storageKey: `materials/${testUserId}/huge-single-page.pdf`,
        mimeType: 'application/pdf',
        bytes: 50000,
        pageCount: 1,
        status: 'READY',
      },
    });

    // Single page with 45,000 characters (exceeds 40,000 max chunk chars)
    await prisma.materialPage.create({
      data: {
        materialId: material.id,
        pageNumber: 1,
        extractedText: 'A'.repeat(45000),
        characterCount: 45000,
      },
    });

    await prisma.aiUsage.create({
      data: {
        userId: testUserId,
        dailyGenerationCount: 1,
        activeJobsCount: 1,
      },
    });

    const procJob = await prisma.processingJob.create({
      data: {
        userId: testUserId,
        materialId: material.id,
        type: 'AI_SUMMARY_GENERATION',
        status: 'PENDING',
      },
    });

    const summary = await prisma.materialSummary.create({
      data: {
        userId: testUserId,
        materialId: material.id,
        status: 'QUEUED',
        activeJobId: procJob.id,
      },
    });

    const mockJob = {
      id: procJob.id,
      attemptsMade: 0,
      opts: { attempts: 3 },
      data: {
        jobId: procJob.id,
        summaryId: summary.id,
        materialId: material.id,
        userId: testUserId,
      },
    } as unknown as Job<AiSummaryJobData>;

    const result = await processAiSummaryJob(mockJob);
    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('DOCUMENT_TOO_LARGE');
    expect(result.error).toContain('Halaman 1');
    expect(result.error).toContain('40.000');

    // Slot is cleanly released exactly once
    const usage = await prisma.aiUsage.findUnique({ where: { userId: testUserId } });
    expect(usage?.activeJobsCount).toBe(0);
  });

  it('should ensure duplicate job execution does NOT decrement slot of another active job', async () => {
    // 1. Create two materials for testUserId
    const matA = await prisma.material.create({
      data: {
        userId: testUserId,
        courseId: testCourseId,
        title: 'Materi A',
        originalFilename: 'mat-a.pdf',
        storageKey: `materials/${testUserId}/mat-a.pdf`,
        mimeType: 'application/pdf',
        bytes: 2000,
        pageCount: 1,
        status: 'READY',
      },
    });
    await prisma.materialPage.create({
      data: {
        materialId: matA.id,
        pageNumber: 1,
        extractedText: 'Teks perkuliahan materi A yang valid untuk diproses.',
        characterCount: 52,
      },
    });

    // 2. User has 2 active jobs currently running: Job A and Job B
    await prisma.aiUsage.create({
      data: {
        userId: testUserId,
        dailyGenerationCount: 2,
        activeJobsCount: 2, // 2 active jobs
      },
    });

    const jobA = await prisma.processingJob.create({
      data: {
        userId: testUserId,
        materialId: matA.id,
        type: 'AI_SUMMARY_GENERATION',
        status: 'PENDING',
      },
    });

    const summaryA = await prisma.materialSummary.create({
      data: {
        userId: testUserId,
        materialId: matA.id,
        status: 'QUEUED',
        activeJobId: jobA.id,
      },
    });

    const mockJobA = {
      id: jobA.id,
      attemptsMade: 0,
      opts: { attempts: 3 },
      data: {
        jobId: jobA.id,
        summaryId: summaryA.id,
        materialId: matA.id,
        userId: testUserId,
      },
    } as unknown as Job<AiSummaryJobData>;

    // 3. First execution of Job A completes successfully
    const result1 = await processAiSummaryJob(mockJobA);
    expect(result1.status).toBe('READY');

    // Active jobs count decreased from 2 -> 1 (Job B is still running!)
    let usage = await prisma.aiUsage.findUnique({ where: { userId: testUserId } });
    expect(usage?.activeJobsCount).toBe(1);

    // 4. DUPLICATE execution of Job A arrives (e.g. BullMQ duplicate delivery)
    const resultDuplicate = await processAiSummaryJob(mockJobA);
    expect(resultDuplicate.status).toBe('READY');

    // CRUCIAL: Active jobs count MUST STILL BE 1! Job B's active slot was NOT stolen/decremented!
    usage = await prisma.aiUsage.findUnique({ where: { userId: testUserId } });
    expect(usage?.activeJobsCount).toBe(1);
  });

  it('should handle Redis disconnection during provider call: no provider call allowed, retries without premature slot release, and finishes once Redis is restored', async () => {
    // 1. Create READY material
    const mat = await prisma.material.create({
      data: {
        userId: testUserId,
        courseId: testCourseId,
        title: 'Materi Redis Resilience Test',
        originalFilename: 'redis-test.pdf',
        storageKey: `materials/${testUserId}/redis-test.pdf`,
        mimeType: 'application/pdf',
        bytes: 1500,
        pageCount: 1,
        status: 'READY',
      },
    });
    await prisma.materialPage.create({
      data: {
        materialId: mat.id,
        pageNumber: 1,
        extractedText: 'Teks kuliah pengujian keandalan Redis dan ketahanan sistem terdistribusi.',
        characterCount: 71,
      },
    });

    await prisma.aiUsage.create({
      data: {
        userId: testUserId,
        dailyGenerationCount: 1,
        activeJobsCount: 1,
      },
    });

    const job = await prisma.processingJob.create({
      data: {
        userId: testUserId,
        materialId: mat.id,
        type: 'AI_SUMMARY_GENERATION',
        status: 'PENDING',
      },
    });

    const summary = await prisma.materialSummary.create({
      data: {
        userId: testUserId,
        materialId: mat.id,
        status: 'QUEUED',
        activeJobId: job.id,
      },
    });

    // Configure rate limiter to forbid in-memory (simulating live production with disconnected Redis)
    const { globalAiRateLimiter } = await import('../services/aiRateLimiter.js');
    globalAiRateLimiter.setRedisClient(null);
    globalAiRateLimiter.setAllowInMemory(false);

    let providerCalled = false;
    mockAdapter.setCustomHandler(async () => {
      // If limiter works correctly, this must never be reached while Redis is down
      await globalAiRateLimiter.acquirePermit(job.id);
      providerCalled = true;
      return {
        title: 'Ringkasan Berhasil',
        overview: 'Overview ringkasan materi',
        keyConcepts: [],
        sections: [],
        keyTerms: [],
        durationMs: 50,
      };
    });

    const mockJobAttempt1 = {
      id: job.id,
      attemptsMade: 0,
      opts: { attempts: 3 },
      data: {
        jobId: job.id,
        summaryId: summary.id,
        materialId: mat.id,
        userId: testUserId,
      },
    } as unknown as Job<AiSummaryJobData>;

    // 2. Attempt 1: Redis is disconnected. Must throw retryable error and NOT call provider
    await expect(processAiSummaryJob(mockJobAttempt1)).rejects.toThrowError(
      /Layanan antrean dan pembatas laju AI \(Redis\) sedang tidak tersedia/
    );
    expect(providerCalled).toBe(false);

    // Slot must NOT have been released prematurely
    let usage = await prisma.aiUsage.findUnique({ where: { userId: testUserId } });
    expect(usage?.activeJobsCount).toBe(1);

    // Job in database must not be marked FAILED yet
    let jobRecord = await prisma.processingJob.findUnique({ where: { id: job.id } });
    expect(jobRecord?.status).toBe('PROCESSING');

    // 3. Redis is restored
    const mockRedis: any = {
      status: 'ready',
      incr: async () => 1,
      expire: async () => 1,
      pipeline: () => ({
        zremrangebyscore: () => {},
        zcard: () => {},
        zadd: () => {},
        expire: () => {},
        exec: async () => [[null, 0], [null, 0]],
      }),
      zrange: async () => [],
    };
    globalAiRateLimiter.setRedisClient(mockRedis);

    // 4. Attempt 2 (Retry): Now runs and completes successfully
    const mockJobAttempt2 = {
      id: job.id,
      attemptsMade: 1,
      opts: { attempts: 3 },
      data: {
        jobId: job.id,
        summaryId: summary.id,
        materialId: mat.id,
        userId: testUserId,
      },
    } as unknown as Job<AiSummaryJobData>;

    const result2 = await processAiSummaryJob(mockJobAttempt2);
    expect(result2.status).toBe('READY');
    expect(providerCalled).toBe(true);

    // Slot is now released exactly once
    usage = await prisma.aiUsage.findUnique({ where: { userId: testUserId } });
    expect(usage?.activeJobsCount).toBe(0);

    jobRecord = await prisma.processingJob.findUnique({ where: { id: job.id } });
    expect(jobRecord?.status).toBe('COMPLETED');

    // Restore test default for rate limiter
    globalAiRateLimiter.setAllowInMemory(true);
    globalAiRateLimiter.setRedisClient(null);
  });
});
