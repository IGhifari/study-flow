import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '@studyflow/database';
import {
  startOrResumeQuizAttempt,
  saveQuizDraftAnswers,
  submitQuizAttempt,
  getQuizAttemptResult,
} from '../services/learning.service.js';

describe('Quiz Attempt Concurrency & Idempotency Tests', () => {
  const app = createApp();
  const TRUSTED_ORIGIN = 'http://localhost:3000';

  let userAId: string;
  let userBId: string;
  let cookieA: string[];
  let cookieB: string[];
  let semAId: string;
  let courseAId: string;
  let materialAId: string;
  let quizAId: string;
  let q1Id: string;
  let q2Id: string;

  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: 'test.quizconcurrency.' } },
    });

    // Create User A
    const emailA = `test.quizconcurrency.a.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Quiz Concurrency User A',
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
    const emailB = `test.quizconcurrency.b.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Quiz Concurrency User B',
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

    // Create READY Material with extracted pages for User A
    const mat = await prisma.material.create({
      data: {
        userId: userAId,
        courseId: courseAId,
        title: 'Materi Pohon Biner Uji Konkurensi',
        originalFilename: 'binary-tree-concurrency.pdf',
        storageKey: `materials/${userAId}/concurrency-tree.pdf`,
        mimeType: 'application/pdf',
        bytes: 18000,
        pageCount: 3,
        status: 'READY',
      },
    });
    materialAId = mat.id;

    await prisma.materialPage.createMany({
      data: [
        {
          materialId: materialAId,
          pageNumber: 1,
          extractedText: 'Pohon biner adalah struktur data berhierarki dengan maksimal dua anak per simpul.',
          characterCount: 80,
        },
        {
          materialId: materialAId,
          pageNumber: 2,
          extractedText: 'Operasi penelusuran pohon biner meliputi preorder, inorder, dan postorder.',
          characterCount: 75,
        },
      ],
    });

    // Create a READY Quiz with 2 deterministic questions
    const quiz = await prisma.quiz.create({
      data: {
        userId: userAId,
        materialId: materialAId,
        title: 'Kuis Pohon Biner Konkurensi',
        targetCount: 2,
        status: 'READY',
        questions: {
          create: [
            {
              question: 'Berapa jumlah anak maksimal simpul pada pohon biner?',
              options: ['1 anak', '2 anak', '3 anak', 'Tidak terbatas'],
              correctIndex: 1, // '2 anak'
              explanation: 'Sesuai definisi, setiap simpul memiliki maksimal 2 anak.',
              pageReferences: [1],
              orderIndex: 0,
            },
            {
              question: 'Penelusuran manakah yang memproses simpul akar di awal?',
              options: ['Preorder', 'Inorder', 'Postorder', 'Levelorder'],
              correctIndex: 0, // 'Preorder'
              explanation: 'Preorder memproses akar terlebih dahulu, kemudian anak kiri dan kanan.',
              pageReferences: [2],
              orderIndex: 1,
            },
          ],
        },
      },
      include: { questions: { orderBy: { orderIndex: 'asc' } } },
    });

    quizAId = quiz.id;
    q1Id = quiz.questions[0].id;
    q2Id = quiz.questions[1].id;
  });

  it('1. Dua submit bersamaan dengan jawaban berbeda: hasil final berasal dari satu submission, tanpa campuran jawaban/skor', async () => {
    // Start attempt
    const startRes = await startOrResumeQuizAttempt(userAId, quizAId);
    const attemptId = startRes.attemptId;

    // Submission 1: both correct (Q1: 1, Q2: 0) -> score 100
    const sub1Answers = [
      { questionId: q1Id, selectedIndex: 1 },
      { questionId: q2Id, selectedIndex: 0 },
    ];

    // Submission 2: both wrong (Q1: 0, Q2: 1) -> score 0
    const sub2Answers = [
      { questionId: q1Id, selectedIndex: 0 },
      { questionId: q2Id, selectedIndex: 1 },
    ];

    // Fire both submit calls simultaneously
    const [result1, result2] = await Promise.all([
      submitQuizAttempt(userAId, attemptId, sub1Answers),
      submitQuizAttempt(userAId, attemptId, sub2Answers),
    ]);

    // Both results MUST be identical because the second submission unblocks, sees submittedAt, and returns the first result
    expect(result1.score).toBe(result2.score);
    expect(result1.submittedAt).toBe(result2.submittedAt);
    expect([0, 100]).toContain(result1.score);

    // Assert that the questions and userSelectedIndex are completely identical across both responses
    for (let i = 0; i < result1.questions.length; i++) {
      expect(result1.questions[i].userSelectedIndex).toBe(result2.questions[i].userSelectedIndex);
      expect(result1.questions[i].isCorrect).toBe(result2.questions[i].isCorrect);
    }

    // Inspect database: quiz_attempt_answers MUST have exactly 2 rows (no duplicates, no mixing)
    const dbAnswers = await prisma.quizAttemptAnswer.findMany({
      where: { attemptId },
      orderBy: { createdAt: 'asc' },
    });
    expect(dbAnswers).toHaveLength(2);

    // Verify DB attempt row matches the returned score
    const dbAttempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
    });
    expect(dbAttempt?.score).toBe(result1.score);
    expect(dbAttempt?.submittedAt).not.toBeNull();
  });

  it('2. Submit ulang setelah selesai: hasil tetap sama dan tidak ada jawaban duplikat', async () => {
    const startRes = await startOrResumeQuizAttempt(userAId, quizAId);
    const attemptId = startRes.attemptId;

    // First submission: Q1 correct (1), Q2 wrong (1) -> score 50
    const initialSubmit = await submitQuizAttempt(userAId, attemptId, [
      { questionId: q1Id, selectedIndex: 1 },
      { questionId: q2Id, selectedIndex: 1 },
    ]);
    expect(initialSubmit.score).toBe(50);
    expect(initialSubmit.correctAnswersCount).toBe(1);

    // Attempt second submission with different answers (e.g. Q1: 0, Q2: 0)
    const secondSubmit = await submitQuizAttempt(userAId, attemptId, [
      { questionId: q1Id, selectedIndex: 0 },
      { questionId: q2Id, selectedIndex: 0 },
    ]);

    // Second submit must return the original score 50 without overwriting
    expect(secondSubmit.score).toBe(50);
    expect(secondSubmit.correctAnswersCount).toBe(1);
    expect(secondSubmit.submittedAt).toBe(initialSubmit.submittedAt);

    // DB answers still exactly 2, with Q1=1 and Q2=1
    const dbAnswers = await prisma.quizAttemptAnswer.findMany({
      where: { attemptId },
    });
    expect(dbAnswers).toHaveLength(2);
    expect(dbAnswers.find((a) => a.questionId === q1Id)?.selectedIndex).toBe(1);
    expect(dbAnswers.find((a) => a.questionId === q2Id)?.selectedIndex).toBe(1);
  });

  it('3. Save draft bersamaan dengan submit: setelah submit selesai, jawaban dan skor tetap konsisten', async () => {
    const startRes = await startOrResumeQuizAttempt(userAId, quizAId);
    const attemptId = startRes.attemptId;

    const draftAnswers = [
      { questionId: q1Id, selectedIndex: 2 },
      { questionId: q2Id, selectedIndex: 3 },
    ];

    const submitAnswers = [
      { questionId: q1Id, selectedIndex: 1 },
      { questionId: q2Id, selectedIndex: 0 },
    ];

    // Fire draft and submit simultaneously
    const results = await Promise.allSettled([
      saveQuizDraftAnswers(userAId, attemptId, draftAnswers),
      submitQuizAttempt(userAId, attemptId, submitAnswers),
    ]);

    // Submit MUST have succeeded
    const submitResult = results[1];
    expect(submitResult.status).toBe('fulfilled');

    // Retrieve attempt evaluation from DB
    const finalResult = await getQuizAttemptResult(userAId, attemptId);

    // The finalized database state must strictly reflect the submitted answers and score 100
    expect(finalResult.score).toBe(100);
    expect(finalResult.correctAnswersCount).toBe(2);

    const q1Final = finalResult.questions.find((q) => q.id === q1Id);
    const q2Final = finalResult.questions.find((q) => q.id === q2Id);
    expect(q1Final?.userSelectedIndex).toBe(1);
    expect(q2Final?.userSelectedIndex).toBe(0);

    // DB answers must NOT have draft values (2 or 3)
    const dbAnswers = await prisma.quizAttemptAnswer.findMany({
      where: { attemptId },
    });
    expect(dbAnswers.find((a) => a.questionId === q1Id)?.selectedIndex).toBe(1);
    expect(dbAnswers.find((a) => a.questionId === q2Id)?.selectedIndex).toBe(0);
  });

  it('4. Save draft setelah submit: ditolak dan tidak mengubah hasil', async () => {
    const startRes = await startOrResumeQuizAttempt(userAId, quizAId);
    const attemptId = startRes.attemptId;

    // Submit attempt with Q1: 1, Q2: 0 (score 100)
    await submitQuizAttempt(userAId, attemptId, [
      { questionId: q1Id, selectedIndex: 1 },
      { questionId: q2Id, selectedIndex: 0 },
    ]);

    // Subsequent draft must be rejected with 400 ATTEMPT_ALREADY_SUBMITTED
    await expect(
      saveQuizDraftAnswers(userAId, attemptId, [
        { questionId: q1Id, selectedIndex: 3 },
      ])
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'ATTEMPT_ALREADY_SUBMITTED',
    });

    // In DB, answer for Q1 must still be 1, never mutated to 3
    const dbAnswer = await prisma.quizAttemptAnswer.findUnique({
      where: { attemptId_questionId: { attemptId, questionId: q1Id } },
    });
    expect(dbAnswer?.selectedIndex).toBe(1);
  });

  it('5. Dua start/resume bersamaan: tidak menciptakan attempt aktif ganda', async () => {
    // Both calls fire simultaneously on a quiz with no existing attempt
    const [attemptA, attemptB] = await Promise.all([
      startOrResumeQuizAttempt(userAId, quizAId),
      startOrResumeQuizAttempt(userAId, quizAId),
    ]);

    // Both must return the EXACT SAME attempt ID
    expect(attemptA.attemptId).toBe(attemptB.attemptId);

    // In DB: exactly ONE active attempt exists for this user and quiz
    const activeAttempts = await prisma.quizAttempt.findMany({
      where: {
        quizId: quizAId,
        userId: userAId,
        submittedAt: null,
      },
    });
    expect(activeAttempts).toHaveLength(1);
  });

  it('6. Pengguna lain tidak dapat membaca atau mengubah attempt', async () => {
    const startRes = await startOrResumeQuizAttempt(userAId, quizAId);
    const attemptId = startRes.attemptId;

    // User B tries to start attempt on User A's quiz
    await expect(startOrResumeQuizAttempt(userBId, quizAId)).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });

    // User B tries to save draft on User A's attempt
    await expect(
      saveQuizDraftAnswers(userBId, attemptId, [{ questionId: q1Id, selectedIndex: 1 }])
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });

    // User B tries to submit User A's attempt
    await expect(
      submitQuizAttempt(userBId, attemptId, [{ questionId: q1Id, selectedIndex: 1 }])
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });

    // User B tries to view User A's attempt result
    await expect(getQuizAttemptResult(userBId, attemptId)).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  });

  it('7. Respons sebelum submit tidak mengandung kunci jawaban/pembahasan', async () => {
    const startRes = await startOrResumeQuizAttempt(userAId, quizAId);

    // Verify all returned questions have NO correctIndex or explanation
    for (const q of startRes.questions) {
      expect((q as any).correctIndex).toBeUndefined();
      expect((q as any).explanation).toBeUndefined();
      expect(q.options).toHaveLength(4);
    }

    // Viewing attempt result before submission is strictly rejected
    await expect(getQuizAttemptResult(userAId, startRes.attemptId)).rejects.toMatchObject({
      statusCode: 400,
      code: 'ATTEMPT_NOT_SUBMITTED',
    });
  });

  it('8. Retake yang sah tetap berfungsi', async () => {
    // 1. Complete Attempt 1
    const attempt1 = await startOrResumeQuizAttempt(userAId, quizAId);
    const submit1 = await submitQuizAttempt(userAId, attempt1.attemptId, [
      { questionId: q1Id, selectedIndex: 1 },
      { questionId: q2Id, selectedIndex: 1 }, // Q2 wrong
    ]);
    expect(submit1.score).toBe(50);

    // 2. User retakes quiz: startOrResumeQuizAttempt creates Attempt 2
    const attempt2 = await startOrResumeQuizAttempt(userAId, quizAId);
    expect(attempt2.attemptId).not.toBe(attempt1.attemptId);
    expect(attempt2.existingAnswers).toEqual({});

    // 3. Complete Attempt 2: both correct
    const submit2 = await submitQuizAttempt(userAId, attempt2.attemptId, [
      { questionId: q1Id, selectedIndex: 1 },
      { questionId: q2Id, selectedIndex: 0 },
    ]);
    expect(submit2.score).toBe(100);

    // Both attempts exist in DB with their distinct scores
    const allUserAttempts = await prisma.quizAttempt.findMany({
      where: { quizId: quizAId, userId: userAId },
      orderBy: { createdAt: 'asc' },
    });
    expect(allUserAttempts).toHaveLength(2);
    expect(allUserAttempts[0].id).toBe(attempt1.attemptId);
    expect(allUserAttempts[0].score).toBe(50);
    expect(allUserAttempts[1].id).toBe(attempt2.attemptId);
    expect(allUserAttempts[1].score).toBe(100);
  });
});
