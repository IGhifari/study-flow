import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@studyflow/database';
import { Job } from 'bullmq';
import {
  processAiFlashcardJob,
  processAiQuizJob,
  AiFlashcardJobData,
  AiQuizJobData,
} from '../queues/aiQueue.js';
import {
  MockAiProviderAdapter,
  setAiProviderAdapterForTesting,
} from '../services/aiProvider.js';

describe('Worker AI Flashcards & Quiz Queue Processing', () => {
  let mockAdapter: MockAiProviderAdapter;
  let testUserId: string;
  let testCourseId: string;
  let testSemesterId: string;

  beforeEach(async () => {
    mockAdapter = new MockAiProviderAdapter();
    setAiProviderAdapterForTesting(mockAdapter);

    // Clean up test data
    await prisma.user.deleteMany({
      where: { email: { contains: 'worker.learning.test' } },
    });

    const user = await prisma.user.create({
      data: {
        email: `worker.learning.test.${Date.now()}@example.com`,
        passwordHash: 'hashed_password_placeholder',
        name: 'Learning Worker Test User',
      },
    });
    testUserId = user.id;

    const semester = await prisma.semester.create({
      data: {
        userId: testUserId,
        name: 'Semester Test Learning',
        academicYear: '2026/2027',
      },
    });
    testSemesterId = semester.id;

    const course = await prisma.course.create({
      data: {
        userId: testUserId,
        semesterId: testSemesterId,
        name: 'Pemrograman Web',
        code: 'CS204',
      },
    });
    testCourseId = course.id;
  });

  describe('processAiFlashcardJob', () => {
    it('should successfully generate flashcards and save cards to DB', async () => {
      const material = await prisma.material.create({
        data: {
          userId: testUserId,
          courseId: testCourseId,
          title: 'Arsitektur Web Modern',
          originalFilename: 'web-arch.pdf',
          storageKey: `materials/${testUserId}/test-web.pdf`,
          mimeType: 'application/pdf',
          bytes: 12000,
          pageCount: 2,
          status: 'READY',
        },
      });

      await prisma.materialPage.createMany({
        data: [
          {
            materialId: material.id,
            pageNumber: 1,
            extractedText: 'Frontend bertugas merender UI dan menangani interaksi pengguna di peramban.',
            characterCount: 75,
          },
          {
            materialId: material.id,
            pageNumber: 2,
            extractedText: 'Backend mengeksekusi logika bisnis, autentikasi, dan manipulasi basis data.',
            characterCount: 73,
          },
        ],
      });

      const flashcardSet = await prisma.flashcardSet.create({
        data: {
          userId: testUserId,
          materialId: material.id,
          title: 'Flashcard Arsitektur Web Modern',
          targetCount: 5,
          status: 'QUEUED',
        },
      });

      const jobRecord = await prisma.processingJob.create({
        data: {
          userId: testUserId,
          materialId: material.id,
          type: 'AI_FLASHCARD_GENERATION',
          status: 'PENDING',
        },
      });

      await prisma.aiUsage.create({
        data: {
          userId: testUserId,
          dailyGenerationCount: 1,
          activeJobsCount: 1,
        },
      });

      const mockJob = {
        id: 'job-fc-1',
        data: {
          jobId: jobRecord.id,
          materialId: material.id,
          userId: testUserId,
          setId: flashcardSet.id,
          targetCount: 5,
        } as AiFlashcardJobData,
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as unknown as Job<AiFlashcardJobData>;

      await processAiFlashcardJob(mockJob);

      // Verify DB record
      const updatedSet = await prisma.flashcardSet.findUnique({
        where: { id: flashcardSet.id },
        include: { cards: true },
      });

      expect(updatedSet?.status).toBe('READY');
      expect(updatedSet?.cards.length).toBeGreaterThan(0);
      expect(updatedSet?.cards[0].front).toBeDefined();
      expect(updatedSet?.cards[0].back).toBeDefined();

      // Verify slot was released
      const usage = await prisma.aiUsage.findUnique({
        where: { userId: testUserId },
      });
      expect(usage?.activeJobsCount).toBe(0);
    });
  });

  describe('processAiQuizJob', () => {
    it('should successfully generate quiz and save questions to DB', async () => {
      const material = await prisma.material.create({
        data: {
          userId: testUserId,
          courseId: testCourseId,
          title: 'Basis Data Lanjutan',
          originalFilename: 'db-advanced.pdf',
          storageKey: `materials/${testUserId}/test-db.pdf`,
          mimeType: 'application/pdf',
          bytes: 14000,
          pageCount: 2,
          status: 'READY',
        },
      });

      await prisma.materialPage.createMany({
        data: [
          {
            materialId: material.id,
            pageNumber: 1,
            extractedText: 'Transaksi ACID menjamin keandalan data dalam sistem basis data relasional.',
            characterCount: 75,
          },
          {
            materialId: material.id,
            pageNumber: 2,
            extractedText: 'Indeks B-Tree mempercepat pencarian data dengan kompleksitas waktu O(log n).',
            characterCount: 77,
          },
        ],
      });

      const quiz = await prisma.quiz.create({
        data: {
          userId: testUserId,
          materialId: material.id,
          title: 'Kuis Basis Data Lanjutan',
          targetCount: 5,
          status: 'QUEUED',
        },
      });

      const jobRecord = await prisma.processingJob.create({
        data: {
          userId: testUserId,
          materialId: material.id,
          type: 'AI_QUIZ_GENERATION',
          status: 'PENDING',
        },
      });

      await prisma.aiUsage.create({
        data: {
          userId: testUserId,
          dailyGenerationCount: 1,
          activeJobsCount: 1,
        },
      });

      const mockJob = {
        id: 'job-qz-1',
        data: {
          jobId: jobRecord.id,
          materialId: material.id,
          userId: testUserId,
          quizId: quiz.id,
          targetCount: 5,
        } as AiQuizJobData,
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as unknown as Job<AiQuizJobData>;

      await processAiQuizJob(mockJob);

      // Verify DB record
      const updatedQuiz = await prisma.quiz.findUnique({
        where: { id: quiz.id },
        include: { questions: true },
      });

      expect(updatedQuiz?.status).toBe('READY');
      expect(updatedQuiz?.questions.length).toBeGreaterThan(0);
      expect(updatedQuiz?.questions[0].question).toBeDefined();
      expect(updatedQuiz?.questions[0].options).toHaveLength(4);
      expect(updatedQuiz?.questions[0].correctIndex).toBeGreaterThanOrEqual(0);
      expect(updatedQuiz?.questions[0].correctIndex).toBeLessThan(4);

      // Verify slot was released
      const usage = await prisma.aiUsage.findUnique({
        where: { userId: testUserId },
      });
      expect(usage?.activeJobsCount).toBe(0);
    });
  });
});
