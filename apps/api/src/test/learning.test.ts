import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '@studyflow/database';

describe('Material AI Flashcard & Quiz Endpoints Verification', () => {
  const app = createApp();
  const TRUSTED_ORIGIN = 'http://localhost:3000';

  let userAId: string;
  let userBId: string;
  let cookieA: string[];
  let cookieB: string[];
  let semAId: string;
  let courseAId: string;
  let readyMaterialAId: string;

  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: 'test.learning.' } },
    });

    // Create User A
    const emailA = `test.learning.a.${Date.now()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Learning User A',
        email: emailA,
        password: 'PasswordSangatKuat123!',
      });
    const loginA = await request(app)
      .post('/api/auth/login')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        email: emailA,
        password: 'PasswordSangatKuat123!',
      });
    userAId = loginA.body.user.id;
    cookieA = loginA.headers['set-cookie'] as unknown as string[];

    // Create User B
    const emailB = `test.learning.b.${Date.now()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Learning User B',
        email: emailB,
        password: 'PasswordSangatKuat123!',
      });
    const loginB = await request(app)
      .post('/api/auth/login')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        email: emailB,
        password: 'PasswordSangatKuat123!',
      });
    userBId = loginB.body.user.id;
    cookieB = loginB.headers['set-cookie'] as unknown as string[];

    // Create Semester & Course for User A
    const semResA = await request(app)
      .post('/api/semesters')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ name: 'Semester Ganjil 2026', academicYear: '2026/2027' });
    semAId = semResA.body.semester.id;

    const courseResA = await request(app)
      .post('/api/courses')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ semesterId: semAId, name: 'Struktur Data & Algoritma', code: 'IF2110' });
    courseAId = courseResA.body.course.id;

    // Create a READY Material with extracted pages for User A
    const mat = await prisma.material.create({
      data: {
        userId: userAId,
        courseId: courseAId,
        title: 'Materi Struktur Data Bab Pohon Biner',
        originalFilename: 'binary-tree.pdf',
        storageKey: `materials/${userAId}/test-tree.pdf`,
        mimeType: 'application/pdf',
        bytes: 18000,
        pageCount: 3,
        status: 'READY',
      },
    });
    readyMaterialAId = mat.id;

    await prisma.materialPage.createMany({
      data: [
        {
          materialId: readyMaterialAId,
          pageNumber: 1,
          extractedText:
            'Pohon biner adalah struktur data pohon di mana setiap simpul memiliki paling banyak dua anak.',
          characterCount: 95,
        },
        {
          materialId: readyMaterialAId,
          pageNumber: 2,
          extractedText:
            'Penelusuran pohon biner meliputi preorder, inorder, dan postorder.',
          characterCount: 66,
        },
      ],
    });
  });

  // ==========================================
  // Flashcard Endpoints Tests
  // ==========================================
  describe('Flashcards', () => {
    it('should allow owner to request flashcards generation with valid target count', async () => {
      const res = await request(app)
        .post(`/api/materials/${readyMaterialAId}/flashcard-sets`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({ targetCount: 10 });

      expect(res.status).toBe(202);
      expect(res.body.setId).toBeDefined();
      expect(res.body.jobId).toBeDefined();

      const createdSet = await prisma.flashcardSet.findUnique({
        where: { id: res.body.setId },
      });
      expect(createdSet).toBeDefined();
      expect(createdSet?.targetCount).toBe(10);
      expect(createdSet?.status).toBe('QUEUED');
    });

    it('should reject invalid flashcard target count (e.g. 15 or 50)', async () => {
      const res = await request(app)
        .post(`/api/materials/${readyMaterialAId}/flashcard-sets`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({ targetCount: 15 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should prevent non-owner (User B) from requesting flashcards for User A material', async () => {
      const res = await request(app)
        .post(`/api/materials/${readyMaterialAId}/flashcard-sets`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieB)
        .send({ targetCount: 5 });

      expect(res.status).toBe(403);
    });

    it('should prevent requesting flashcards for archived course', async () => {
      // Archive course
      await prisma.course.update({
        where: { id: courseAId },
        data: { archivedAt: new Date() },
      });

      const res = await request(app)
        .post(`/api/materials/${readyMaterialAId}/flashcard-sets`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({ targetCount: 10 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('COURSE_ARCHIVED');
    });

    it('should allow updating flashcard mastery status and reject non-owner', async () => {
      // Create flashcard set and card for User A
      const set = await prisma.flashcardSet.create({
        data: {
          userId: userAId,
          materialId: readyMaterialAId,
          title: 'Set Pohon Biner',
          targetCount: 5,
          status: 'READY',
          cards: {
            create: [
              {
                front: 'Apa itu Pohon Biner?',
                back: 'Struktur pohon dengan paling banyak 2 anak per simpul.',
                pageReferences: [1],
                orderIndex: 0,
              },
            ],
          },
        },
        include: { cards: true },
      });

      const cardId = set.cards[0].id;

      // Update as User A
      const resA = await request(app)
        .patch(`/api/flashcards/${cardId}`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({ masteryStatus: 'MASTERED' });

      expect(resA.status).toBe(200);
      expect(resA.body.masteryStatus).toBe('MASTERED');

      // Attempt update as User B
      const resB = await request(app)
        .patch(`/api/flashcards/${cardId}`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieB)
        .send({ masteryStatus: 'NEED_REVIEW' });

      expect(resB.status).toBe(403);
    });
  });

  // ==========================================
  // Quiz Endpoints & Attempt Security Tests
  // ==========================================
  describe('Quiz & Attempts', () => {
    it('should allow owner to request quiz generation with valid target count (5 or 10)', async () => {
      const res = await request(app)
        .post(`/api/materials/${readyMaterialAId}/quizzes`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({ targetCount: 5 });

      expect(res.status).toBe(202);
      expect(res.body.quizId).toBeDefined();
      expect(res.body.jobId).toBeDefined();

      const createdQuiz = await prisma.quiz.findUnique({
        where: { id: res.body.quizId },
      });
      expect(createdQuiz).toBeDefined();
      expect(createdQuiz?.targetCount).toBe(5);
      expect(createdQuiz?.status).toBe('QUEUED');
    });

    it('should reject invalid quiz target count (e.g. 20)', async () => {
      const res = await request(app)
        .post(`/api/materials/${readyMaterialAId}/quizzes`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({ targetCount: 20 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should NOT leak correctIndex or explanation when starting or resuming quiz attempt', async () => {
      // Create READY quiz with 2 questions
      const quiz = await prisma.quiz.create({
        data: {
          userId: userAId,
          materialId: readyMaterialAId,
          title: 'Kuis Pohon Biner',
          targetCount: 5,
          status: 'READY',
          questions: {
            create: [
              {
                question: 'Berapa jumlah anak maksimal simpul pohon biner?',
                options: ['1', '2', '3', 'Tidak terbatas'],
                correctIndex: 1,
                explanation: 'Pohon biner dibatasi paling banyak dua anak.',
                pageReferences: [1],
                orderIndex: 0,
              },
              {
                question: 'Penelusuran mana yang memproses akar di tengah?',
                options: ['Preorder', 'Inorder', 'Postorder', 'Level order'],
                correctIndex: 1,
                explanation: 'Inorder memproses anak kiri, simpul saat ini, lalu anak kanan.',
                pageReferences: [2],
                orderIndex: 1,
              },
            ],
          },
        },
        include: { questions: true },
      });

      // User A starts attempt
      const startRes = await request(app)
        .post(`/api/quizzes/${quiz.id}/attempts`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send();

      expect(startRes.status).toBe(200);
      expect(startRes.body.attemptId).toBeDefined();
      expect(startRes.body.questions).toHaveLength(2);

      // Verify that NO question leaks correctIndex or explanation
      for (const q of startRes.body.questions) {
        expect((q as any).correctIndex).toBeUndefined();
        expect((q as any).explanation).toBeUndefined();
        expect(q.options).toHaveLength(4);
      }

      // User B cannot access or start User A quiz
      const startResB = await request(app)
        .post(`/api/quizzes/${quiz.id}/attempts`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieB)
        .send();

      expect(startResB.status).toBe(403);
    });

    it('should evaluate answers on backend, calculate score, and support idempotent submission', async () => {
      // Create READY quiz with 2 questions
      const quiz = await prisma.quiz.create({
        data: {
          userId: userAId,
          materialId: readyMaterialAId,
          title: 'Kuis Pohon Biner Evaluasi',
          targetCount: 5,
          status: 'READY',
          questions: {
            create: [
              {
                question: 'Soal 1',
                options: ['A', 'B', 'C', 'D'],
                correctIndex: 0,
                explanation: 'Jawaban benar adalah A',
                pageReferences: [1],
                orderIndex: 0,
              },
              {
                question: 'Soal 2',
                options: ['W', 'X', 'Y', 'Z'],
                correctIndex: 2,
                explanation: 'Jawaban benar adalah Y',
                pageReferences: [2],
                orderIndex: 1,
              },
            ],
          },
        },
        include: { questions: true },
      });

      const q1 = quiz.questions[0];
      const q2 = quiz.questions[1];

      // Start attempt
      const startRes = await request(app)
        .post(`/api/quizzes/${quiz.id}/attempts`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send();

      const attemptId = startRes.body.attemptId;

      // Submit attempt: Q1 correct (0), Q2 wrong (1 instead of 2) -> 1 of 2 correct = 50%
      const submitRes = await request(app)
        .post(`/api/attempts/${attemptId}/submit`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({
          answers: [
            { questionId: q1.id, selectedIndex: 0 },
            { questionId: q2.id, selectedIndex: 1 },
          ],
        });

      expect(submitRes.status).toBe(200);
      expect(submitRes.body.score).toBe(50);
      expect(submitRes.body.submittedAt).not.toBeNull();
      expect(submitRes.body.questions).toHaveLength(2);

      // Now completed questions DO contain correctIndex and explanation
      const completedQ1 = submitRes.body.questions.find((q: any) => q.id === q1.id);
      expect(completedQ1.correctIndex).toBe(0);
      expect(completedQ1.userSelectedIndex).toBe(0);
      expect(completedQ1.isCorrect).toBe(true);
      expect(completedQ1.explanation).toBe('Jawaban benar adalah A');

      const completedQ2 = submitRes.body.questions.find((q: any) => q.id === q2.id);
      expect(completedQ2.correctIndex).toBe(2);
      expect(completedQ2.userSelectedIndex).toBe(1);
      expect(completedQ2.isCorrect).toBe(false);

      // Idempotent test: submit again returns the same result without error or duplicate records
      const duplicateRes = await request(app)
        .post(`/api/attempts/${attemptId}/submit`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({
          answers: [
            { questionId: q1.id, selectedIndex: 0 },
            { questionId: q2.id, selectedIndex: 1 },
          ],
        });

      expect(duplicateRes.status).toBe(200);
      expect(duplicateRes.body.score).toBe(50);

      const dbAnswers = await prisma.quizAttemptAnswer.findMany({
        where: { attemptId },
      });
      expect(dbAnswers).toHaveLength(2);
    });

    it('should persist quiz answers before submit, resume attempt with preserved answers on reload, and never leak keys', async () => {
      // 1. Create quiz with 3 questions
      const quiz = await prisma.quiz.create({
        data: {
          userId: userAId,
          materialId: readyMaterialAId,
          title: 'Kuis Pohon Biner Resume Test',
          targetCount: 5,
          status: 'READY',
          questions: {
            create: [
              {
                question: 'Definisi pohon biner?',
                options: ['Maks 1 anak', 'Maks 2 anak', 'Maks 3 anak', 'Tanpa anak'],
                correctIndex: 1,
                explanation: 'Pohon biner memiliki maksimal 2 anak.',
                pageReferences: [1],
                orderIndex: 0,
              },
              {
                question: 'Simpul paling atas disebut?',
                options: ['Leaf', 'Branch', 'Root', 'Edge'],
                correctIndex: 2,
                explanation: 'Simpul paling atas adalah root (akar).',
                pageReferences: [1],
                orderIndex: 1,
              },
              {
                question: 'Simpul tanpa anak disebut?',
                options: ['Leaf', 'Root', 'Internal', 'Null'],
                correctIndex: 0,
                explanation: 'Simpul daun (leaf) tidak memiliki anak.',
                pageReferences: [2],
                orderIndex: 2,
              },
            ],
          },
        },
        include: { questions: true },
      });

      const [q1, q2, q3] = quiz.questions;

      // 2. Start attempt
      const startRes = await request(app)
        .post(`/api/quizzes/${quiz.id}/attempts`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send();

      expect(startRes.status).toBe(200);
      const attemptId = startRes.body.attemptId;
      expect(startRes.body.existingAnswers).toEqual({});

      // Verify no answers or explanations leaked
      for (const q of startRes.body.questions) {
        expect((q as any).correctIndex).toBeUndefined();
        expect((q as any).explanation).toBeUndefined();
      }

      // 3. Save draft answers for question 1 and question 2 before submit
      const saveDraftRes = await request(app)
        .patch(`/api/attempts/${attemptId}/answers`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({
          answers: [
            { questionId: q1.id, selectedIndex: 1 },
            { questionId: q2.id, selectedIndex: 2 },
          ],
        });

      expect(saveDraftRes.status).toBe(200);
      expect(saveDraftRes.body.success).toBe(true);

      // Verify draft answers in DB do not leak or mark as correct prematurely
      const draftAnswers = await prisma.quizAttemptAnswer.findMany({
        where: { attemptId },
      });
      expect(draftAnswers).toHaveLength(2);
      expect(draftAnswers.find((a) => a.questionId === q1.id)?.selectedIndex).toBe(1);
      expect(draftAnswers.find((a) => a.questionId === q2.id)?.selectedIndex).toBe(2);

      // 4. Simulate page refresh / resume attempt
      const resumeRes = await request(app)
        .post(`/api/quizzes/${quiz.id}/attempts`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send();

      expect(resumeRes.status).toBe(200);
      expect(resumeRes.body.attemptId).toBe(attemptId);
      expect(resumeRes.body.existingAnswers).toEqual({
        [q1.id]: 1,
        [q2.id]: 2,
      });

      // Still NO correctIndex or explanation leaked!
      for (const q of resumeRes.body.questions) {
        expect((q as any).correctIndex).toBeUndefined();
        expect((q as any).explanation).toBeUndefined();
      }

      // 5. User answers remaining question and submits
      const submitRes = await request(app)
        .post(`/api/attempts/${attemptId}/submit`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({
          answers: [
            { questionId: q1.id, selectedIndex: 1 },
            { questionId: q2.id, selectedIndex: 2 },
            { questionId: q3.id, selectedIndex: 0 },
          ],
        });

      expect(submitRes.status).toBe(200);
      expect(submitRes.body.score).toBe(100);
      expect(submitRes.body.correctAnswersCount).toBe(3);

      // After submission, correctIndex and explanation are present
      const submittedQ1 = submitRes.body.questions.find((q: any) => q.id === q1.id);
      expect(submittedQ1.correctIndex).toBe(1);
      expect(submittedQ1.explanation).toBe('Pohon biner memiliki maksimal 2 anak.');
    });

    it('should enforce PRD soft delete retention: clean up downstream flashcards, quizzes, attempts and reject direct endpoint access', async () => {
      // Create a dedicated material with flashcards, quizzes, and attempt
      const matToDelete = await prisma.material.create({
        data: {
          userId: userAId,
          courseId: courseAId,
          title: 'Materi Siap Hapus',
          originalFilename: 'to-delete.pdf',
          storageKey: `materials/${userAId}/to-delete.pdf`,
          mimeType: 'application/pdf',
          bytes: 15000,
          pageCount: 2,
          status: 'READY',
        },
      });

      // Create flashcard set
      const fSet = await prisma.flashcardSet.create({
        data: {
          userId: userAId,
          materialId: matToDelete.id,
          title: 'Flashcard Materi Hapus',
          status: 'READY',
          cards: {
            create: [
              {
                front: 'Kartu 1',
                back: 'Isi 1',
                pageReferences: [1],
                orderIndex: 0,
              },
            ],
          },
        },
        include: { cards: true },
      });
      const cardId = fSet.cards[0].id;

      // Create quiz
      const quiz = await prisma.quiz.create({
        data: {
          userId: userAId,
          materialId: matToDelete.id,
          title: 'Kuis Materi Hapus',
          status: 'READY',
          questions: {
            create: [
              {
                question: 'Pertanyaan Hapus',
                options: ['1', '2', '3', '4'],
                correctIndex: 0,
                explanation: 'Penjelasan',
                pageReferences: [1],
                orderIndex: 0,
              },
            ],
          },
        },
        include: { questions: true },
      });

      // Start attempt
      const startRes = await request(app)
        .post(`/api/quizzes/${quiz.id}/attempts`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send();
      const attemptId = startRes.body.attemptId;

      // Save a draft answer
      await request(app)
        .patch(`/api/attempts/${attemptId}/answers`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({
          answers: [{ questionId: quiz.questions[0].id, selectedIndex: 0 }],
        });

      // Perform soft delete on the material via API
      const deleteRes = await request(app)
        .delete(`/api/materials/${matToDelete.id}`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA);
      expect(deleteRes.status).toBe(200);

      // Verify material is soft-deleted
      const matAfter = await prisma.material.findUnique({
        where: { id: matToDelete.id },
      });
      expect(matAfter?.deletedAt).not.toBeNull();

      // Check PRD retention: downstream AI records should be cleaned up
      const quizzesRemaining = await prisma.quiz.findMany({
        where: { materialId: matToDelete.id },
      });
      expect(quizzesRemaining).toHaveLength(0);

      const flashcardsRemaining = await prisma.flashcardSet.findMany({
        where: { materialId: matToDelete.id },
      });
      expect(flashcardsRemaining).toHaveLength(0);

      const attemptsRemaining = await prisma.quizAttempt.findMany({
        where: { id: attemptId },
      });
      expect(attemptsRemaining).toHaveLength(0);

      // Verify direct endpoint access to downstream items returns 404 NOT_FOUND
      const cardAccess = await request(app)
        .patch(`/api/flashcards/${cardId}`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({ masteryStatus: 'MASTERED' });
      expect(cardAccess.status).toBe(404);

      const quizStartAccess = await request(app)
        .post(`/api/quizzes/${quiz.id}/attempts`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send();
      expect(quizStartAccess.status).toBe(404);

      const attemptSubmitAccess = await request(app)
        .post(`/api/attempts/${attemptId}/submit`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({ answers: [] });
      expect(attemptSubmitAccess.status).toBe(404);

      const attemptResultAccess = await request(app)
        .get(`/api/attempts/${attemptId}`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA);
      expect(attemptResultAccess.status).toBe(404);

      const attemptAnswersAccess = await request(app)
        .patch(`/api/attempts/${attemptId}/answers`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({ answers: [] });
      expect(attemptAnswersAccess.status).toBe(404);
    });
  });

  // ==========================================
  // AI Quota, Document Size Limits & CSRF Protection
  // ==========================================
  describe('Quota 429, Document Size Validation & CSRF Protection', () => {
    it('should return 429 AI_DAILY_QUOTA_EXCEEDED for flashcard-sets and quizzes when daily quota (20) is exhausted', async () => {
      await prisma.aiUsage.upsert({
        where: { userId: userAId },
        create: {
          userId: userAId,
          dailyGenerationCount: 20,
          activeJobsCount: 0,
        },
        update: {
          dailyGenerationCount: 20,
          activeJobsCount: 0,
        },
      });

      const flashcardRes = await request(app)
        .post(`/api/materials/${readyMaterialAId}/flashcard-sets`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({ targetCount: 10 });

      expect(flashcardRes.status).toBe(429);
      expect(flashcardRes.body.error.code).toBe('AI_DAILY_QUOTA_EXCEEDED');
      expect(flashcardRes.body.error.details).toEqual({
        dailyCount: 20,
        dailyLimit: 20,
      });

      const quizRes = await request(app)
        .post(`/api/materials/${readyMaterialAId}/quizzes`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({ targetCount: 5 });

      expect(quizRes.status).toBe(429);
      expect(quizRes.body.error.code).toBe('AI_DAILY_QUOTA_EXCEEDED');
      expect(quizRes.body.error.details).toEqual({
        dailyCount: 20,
        dailyLimit: 20,
      });
    });

    it('should return 429 AI_CONCURRENT_LIMIT_EXCEEDED for flashcard-sets and quizzes when active jobs limit (2) is full', async () => {
      await prisma.aiUsage.upsert({
        where: { userId: userAId },
        create: {
          userId: userAId,
          dailyGenerationCount: 5,
          activeJobsCount: 2,
        },
        update: {
          dailyGenerationCount: 5,
          activeJobsCount: 2,
        },
      });

      const flashcardRes = await request(app)
        .post(`/api/materials/${readyMaterialAId}/flashcard-sets`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({ targetCount: 10 });

      expect(flashcardRes.status).toBe(429);
      expect(flashcardRes.body.error.code).toBe('AI_CONCURRENT_LIMIT_EXCEEDED');
      expect(flashcardRes.body.error.details).toEqual({
        activeJobs: 2,
        maxConcurrent: 2,
      });

      const quizRes = await request(app)
        .post(`/api/materials/${readyMaterialAId}/quizzes`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({ targetCount: 5 });

      expect(quizRes.status).toBe(429);
      expect(quizRes.body.error.code).toBe('AI_CONCURRENT_LIMIT_EXCEEDED');
      expect(quizRes.body.error.details).toEqual({
        activeJobs: 2,
        maxConcurrent: 2,
      });
    });

    it('should reject documents exceeding single-page character limit (> 40,000) upfront with 400 DOCUMENT_TOO_LARGE without deducting AI quota', async () => {
      const matWithHugePage = await prisma.material.create({
        data: {
          userId: userAId,
          courseId: courseAId,
          title: 'Materi Satu Halaman 45rb Karakter',
          originalFilename: 'huge-page.pdf',
          storageKey: `materials/${userAId}/huge-page-learning.pdf`,
          mimeType: 'application/pdf',
          bytes: 60000,
          pageCount: 1,
          status: 'READY',
        },
      });

      await prisma.materialPage.create({
        data: {
          materialId: matWithHugePage.id,
          pageNumber: 1,
          extractedText: 'A'.repeat(45000),
          characterCount: 45000,
        },
      });

      const flashcardRes = await request(app)
        .post(`/api/materials/${matWithHugePage.id}/flashcard-sets`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({ targetCount: 10 });

      expect(flashcardRes.status).toBe(400);
      expect(flashcardRes.body.error.code).toBe('DOCUMENT_TOO_LARGE');

      const quizRes = await request(app)
        .post(`/api/materials/${matWithHugePage.id}/quizzes`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({ targetCount: 5 });

      expect(quizRes.status).toBe(400);
      expect(quizRes.body.error.code).toBe('DOCUMENT_TOO_LARGE');

      // Verify user AI quota was NOT touched
      const usage = await prisma.aiUsage.findUnique({ where: { userId: userAId } });
      expect(usage?.dailyGenerationCount ?? 0).toBe(0);
      expect(usage?.activeJobsCount ?? 0).toBe(0);
    });

    it('should reject documents exceeding total character limit (> 120,000) upfront with 400 DOCUMENT_TOO_LARGE without deducting AI quota', async () => {
      const matOverLimit = await prisma.material.create({
        data: {
          userId: userAId,
          courseId: courseAId,
          title: 'Materi Total 140rb Karakter',
          originalFilename: 'huge-total.pdf',
          storageKey: `materials/${userAId}/huge-total-learning.pdf`,
          mimeType: 'application/pdf',
          bytes: 150000,
          pageCount: 4,
          status: 'READY',
        },
      });

      await prisma.materialPage.createMany({
        data: [
          { materialId: matOverLimit.id, pageNumber: 1, extractedText: 'A'.repeat(35000), characterCount: 35000 },
          { materialId: matOverLimit.id, pageNumber: 2, extractedText: 'B'.repeat(35000), characterCount: 35000 },
          { materialId: matOverLimit.id, pageNumber: 3, extractedText: 'C'.repeat(35000), characterCount: 35000 },
          { materialId: matOverLimit.id, pageNumber: 4, extractedText: 'D'.repeat(35000), characterCount: 35000 },
        ],
      });

      const flashcardRes = await request(app)
        .post(`/api/materials/${matOverLimit.id}/flashcard-sets`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({ targetCount: 10 });

      expect(flashcardRes.status).toBe(400);
      expect(flashcardRes.body.error.code).toBe('DOCUMENT_TOO_LARGE');

      const quizRes = await request(app)
        .post(`/api/materials/${matOverLimit.id}/quizzes`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({ targetCount: 5 });

      expect(quizRes.status).toBe(400);
      expect(quizRes.body.error.code).toBe('DOCUMENT_TOO_LARGE');

      // Verify user AI quota was NOT touched
      const usage = await prisma.aiUsage.findUnique({ where: { userId: userAId } });
      expect(usage?.dailyGenerationCount ?? 0).toBe(0);
      expect(usage?.activeJobsCount ?? 0).toBe(0);
    });

    it('should reject mutations to flashcards, quizzes/attempts, attempts/answers, and attempts/submit without Origin/Referer or with foreign Origin with 403 CSRF_ORIGIN_INVALID', async () => {
      const FOREIGN_ORIGIN = 'https://evil-attacker.example.com';

      // Missing Origin/Referer
      const patchFlashcardNoOrigin = await request(app)
        .patch('/api/flashcards/00000000-0000-0000-0000-000000000001')
        .set('Cookie', cookieA)
        .send({ masteryStatus: 'MASTERED' });
      expect(patchFlashcardNoOrigin.status).toBe(403);
      expect(patchFlashcardNoOrigin.body.error.code).toBe('CSRF_ORIGIN_INVALID');

      const startAttemptNoOrigin = await request(app)
        .post('/api/quizzes/00000000-0000-0000-0000-000000000001/attempts')
        .set('Cookie', cookieA)
        .send();
      expect(startAttemptNoOrigin.status).toBe(403);
      expect(startAttemptNoOrigin.body.error.code).toBe('CSRF_ORIGIN_INVALID');

      const patchAnswersNoOrigin = await request(app)
        .patch('/api/attempts/00000000-0000-0000-0000-000000000001/answers')
        .set('Cookie', cookieA)
        .send({ answers: [] });
      expect(patchAnswersNoOrigin.status).toBe(403);
      expect(patchAnswersNoOrigin.body.error.code).toBe('CSRF_ORIGIN_INVALID');

      const submitAttemptNoOrigin = await request(app)
        .post('/api/attempts/00000000-0000-0000-0000-000000000001/submit')
        .set('Cookie', cookieA)
        .send({ answers: [] });
      expect(submitAttemptNoOrigin.status).toBe(403);
      expect(submitAttemptNoOrigin.body.error.code).toBe('CSRF_ORIGIN_INVALID');

      // Foreign Origin
      const patchFlashcardForeign = await request(app)
        .patch('/api/flashcards/00000000-0000-0000-0000-000000000001')
        .set('Origin', FOREIGN_ORIGIN)
        .set('Cookie', cookieA)
        .send({ masteryStatus: 'MASTERED' });
      expect(patchFlashcardForeign.status).toBe(403);
      expect(patchFlashcardForeign.body.error.code).toBe('CSRF_ORIGIN_INVALID');

      const startAttemptForeign = await request(app)
        .post('/api/quizzes/00000000-0000-0000-0000-000000000001/attempts')
        .set('Origin', FOREIGN_ORIGIN)
        .set('Cookie', cookieA)
        .send();
      expect(startAttemptForeign.status).toBe(403);
      expect(startAttemptForeign.body.error.code).toBe('CSRF_ORIGIN_INVALID');

      const patchAnswersForeign = await request(app)
        .patch('/api/attempts/00000000-0000-0000-0000-000000000001/answers')
        .set('Origin', FOREIGN_ORIGIN)
        .set('Cookie', cookieA)
        .send({ answers: [] });
      expect(patchAnswersForeign.status).toBe(403);
      expect(patchAnswersForeign.body.error.code).toBe('CSRF_ORIGIN_INVALID');

      const submitAttemptForeign = await request(app)
        .post('/api/attempts/00000000-0000-0000-0000-000000000001/submit')
        .set('Origin', FOREIGN_ORIGIN)
        .set('Cookie', cookieA)
        .send({ answers: [] });
      expect(submitAttemptForeign.status).toBe(403);
      expect(submitAttemptForeign.body.error.code).toBe('CSRF_ORIGIN_INVALID');
    });
  });
});
