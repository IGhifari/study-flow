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
  });
});
