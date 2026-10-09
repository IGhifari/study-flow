import { prisma } from '@studyflow/database';
import { env } from '../config/env.js';
import {
  AI_SUMMARY_LIMITS,
  ClientQuizQuestion,
  CompletedQuizQuestion,
  QuizAttemptResponse,
  StartQuizAttemptResponse,
} from '@studyflow/shared';
import { checkAndReserveAiQuota } from './aiQuota.service.js';
import { dispatchOutboxEvents } from './outbox.service.js';
import crypto from 'node:crypto';

function createError(statusCode: number, code: string, message: string) {
  const err = new Error(message) as any;
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

/**
 * Validates that material exists, belongs to user, is not archived, is READY, and has adequate text.
 */
async function validateMaterialForLearningGeneration(userId: string, materialId: string) {
  const material = await prisma.material.findUnique({
    where: { id: materialId },
    include: {
      course: {
        include: {
          semester: true,
        },
      },
    },
  });

  if (!material || material.deletedAt !== null) {
    throw createError(404, 'NOT_FOUND', 'Materi tidak ditemukan');
  }

  if (material.userId !== userId) {
    throw createError(403, 'FORBIDDEN', 'Anda tidak memiliki akses ke materi ini');
  }

  if (material.course.archivedAt) {
    throw createError(
      400,
      'COURSE_ARCHIVED',
      'Mata kuliah telah diarsipkan. Fitur AI tidak dapat digunakan untuk materi pada mata kuliah yang diarsipkan.'
    );
  }

  if (material.course.semester.archivedAt) {
    throw createError(
      400,
      'SEMESTER_ARCHIVED',
      'Semester telah diarsipkan. Fitur AI tidak dapat digunakan untuk materi pada semester yang diarsipkan.'
    );
  }

  if (material.status !== 'READY') {
    if (material.status === 'FAILED') {
      throw createError(400, 'MATERIAL_PROCESSING_FAILED', 'Materi gagal diproses. Konten AI tidak dapat dibuat.');
    }
    throw createError(
      400,
      'MATERIAL_NOT_READY',
      'Materi masih dalam proses ekstraksi teks. Harap tunggu hingga status materi READY.'
    );
  }

  if (env.AI_PROVIDER === 'none') {
    throw createError(503, 'AI_PROVIDER_UNAVAILABLE', 'Layanan AI dinonaktifkan oleh administrator.');
  }
  if (env.AI_PROVIDER === 'gemini' && !env.GEMINI_API_KEY) {
    throw createError(503, 'AI_PROVIDER_UNCONFIGURED', 'Layanan Gemini AI belum dikonfigurasi (GEMINI_API_KEY belum diatur).');
  }

  if (material.pageCount && material.pageCount > AI_SUMMARY_LIMITS.maxPages) {
    throw createError(
      400,
      'DOCUMENT_TOO_LARGE',
      `Dokumen terlalu panjang untuk diproses (maksimal ${AI_SUMMARY_LIMITS.maxPages} halaman).`
    );
  }

  const pageCount = await prisma.materialPage.count({ where: { materialId } });
  if (pageCount === 0) {
    throw createError(400, 'INSUFFICIENT_TEXT', 'Materi tidak memiliki teks hasil ekstraksi untuk diproses.');
  }

  const pages = await prisma.materialPage.findMany({
    where: { materialId },
    select: { pageNumber: true, characterCount: true },
    orderBy: { pageNumber: 'asc' },
  });
  const totalChars = pages.reduce((acc, p) => acc + p.characterCount, 0);

  if (totalChars < 50) {
    throw createError(400, 'INSUFFICIENT_TEXT', 'Teks hasil ekstraksi materi terlalu pendek untuk dibuatkan konten AI.');
  }

  return { material, pages, totalChars, pageCount };
}

// ==========================================
// Flashcards Service
// ==========================================

export async function getFlashcardSets(userId: string, materialId: string) {
  const material = await prisma.material.findUnique({
    where: { id: materialId },
  });
  if (!material || material.deletedAt !== null) {
    throw createError(404, 'NOT_FOUND', 'Materi tidak ditemukan');
  }
  if (material.userId !== userId) {
    throw createError(403, 'FORBIDDEN', 'Anda tidak memiliki akses ke materi ini');
  }

  const sets = await prisma.flashcardSet.findMany({
    where: { materialId, userId },
    orderBy: { createdAt: 'desc' },
    include: {
      cards: {
        orderBy: { orderIndex: 'asc' },
      },
    },
  });

  return sets.map((s) => ({
    id: s.id,
    userId: s.userId,
    materialId: s.materialId,
    title: s.title,
    cardCount: s.cardCount,
    status: s.status,
    targetCount: s.targetCount,
    activeJobId: s.activeJobId,
    errorCode: s.errorCode,
    errorMessage: s.errorMessage,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    cards: s.cards.map((c) => ({
      id: c.id,
      setId: c.setId,
      front: c.front,
      back: c.back,
      pageReferences: c.pageReferences,
      orderIndex: c.orderIndex,
      masteryStatus: c.masteryStatus,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
  }));
}

export async function requestFlashcardGeneration(
  userId: string,
  materialId: string,
  targetCount: 5 | 10 | 20 = 10
) {
  const { material } = await validateMaterialForLearningGeneration(userId, materialId);

  return await prisma.$transaction(async (tx) => {
    // Serialize per material
    await tx.$executeRaw`SELECT id FROM materials WHERE id = ${materialId} FOR UPDATE`;

    // Check existing active sets
    const existingActive = await tx.flashcardSet.findFirst({
      where: {
        materialId,
        userId,
        status: { in: ['QUEUED', 'PROCESSING'] },
      },
    });
    if (existingActive) {
      return {
        setId: existingActive.id,
        jobId: existingActive.activeJobId || existingActive.id,
        message: 'Pembuatan flashcard sedang berjalan',
      };
    }

    // Check & reserve user shared AI quota
    await checkAndReserveAiQuota(tx, userId);

    const setId = crypto.randomUUID();
    const job = await tx.processingJob.create({
      data: {
        userId,
        materialId,
        type: 'AI_FLASHCARD_GENERATION',
        status: 'PENDING',
        attempts: 0,
        maxAttempts: 3,
        payload: {
          setId,
          materialId,
          userId,
          targetCount,
        },
      },
    });

    const set = await tx.flashcardSet.create({
      data: {
        id: setId,
        userId,
        materialId,
        title: `Flashcard: ${material.title}`,
        status: 'QUEUED',
        targetCount,
        activeJobId: job.id,
      },
    });

    await tx.outboxEvent.create({
      data: {
        eventType: 'AI_FLASHCARD_REQUESTED',
        aggregateId: job.id,
        payload: {
          jobId: job.id,
          setId: set.id,
          materialId,
          userId,
          targetCount,
        },
      },
    });

    // Non-blocking immediate outbox dispatch
    dispatchOutboxEvents().catch(() => {});

    return {
      setId: set.id,
      jobId: job.id,
      message: 'Pembuatan flashcard sedang diproses',
    };
  });
}

export async function updateFlashcardMastery(
  userId: string,
  flashcardId: string,
  masteryStatus: 'UNRATED' | 'NEED_REVIEW' | 'MASTERED'
) {
  const card = await prisma.flashcard.findUnique({
    where: { id: flashcardId },
    include: {
      set: {
        include: {
          material: { select: { deletedAt: true } },
        },
      },
    },
  });

  if (!card || (card.set.material && card.set.material.deletedAt !== null)) {
    throw createError(404, 'NOT_FOUND', 'Kartu flashcard tidak ditemukan');
  }

  if (card.set.userId !== userId) {
    throw createError(403, 'FORBIDDEN', 'Anda tidak memiliki akses ke kartu flashcard ini');
  }

  const updated = await prisma.flashcard.update({
    where: { id: flashcardId },
    data: { masteryStatus },
  });

  return {
    id: updated.id,
    setId: updated.setId,
    front: updated.front,
    back: updated.back,
    pageReferences: updated.pageReferences,
    orderIndex: updated.orderIndex,
    masteryStatus: updated.masteryStatus,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// ==========================================
// Quiz Service
// ==========================================

export async function getQuizzes(userId: string, materialId: string) {
  const material = await prisma.material.findUnique({
    where: { id: materialId },
  });
  if (!material || material.deletedAt !== null) {
    throw createError(404, 'NOT_FOUND', 'Materi tidak ditemukan');
  }
  if (material.userId !== userId) {
    throw createError(403, 'FORBIDDEN', 'Anda tidak memiliki akses ke materi ini');
  }

  const quizzes = await prisma.quiz.findMany({
    where: { materialId, userId },
    orderBy: { createdAt: 'desc' },
  });

  return quizzes.map((q) => ({
    id: q.id,
    userId: q.userId,
    materialId: q.materialId,
    title: q.title,
    questionCount: q.questionCount,
    status: q.status,
    targetCount: q.targetCount,
    activeJobId: q.activeJobId,
    errorCode: q.errorCode,
    errorMessage: q.errorMessage,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  }));
}

export async function requestQuizGeneration(
  userId: string,
  materialId: string,
  targetCount: 5 | 10 = 5
) {
  const { material } = await validateMaterialForLearningGeneration(userId, materialId);

  return await prisma.$transaction(async (tx) => {
    // Serialize per material
    await tx.$executeRaw`SELECT id FROM materials WHERE id = ${materialId} FOR UPDATE`;

    const existingActive = await tx.quiz.findFirst({
      where: {
        materialId,
        userId,
        status: { in: ['QUEUED', 'PROCESSING'] },
      },
    });
    if (existingActive) {
      return {
        quizId: existingActive.id,
        jobId: existingActive.activeJobId || existingActive.id,
        message: 'Pembuatan kuis sedang berjalan',
      };
    }

    // Check & reserve user shared AI quota
    await checkAndReserveAiQuota(tx, userId);

    const quizId = crypto.randomUUID();
    const job = await tx.processingJob.create({
      data: {
        userId,
        materialId,
        type: 'AI_QUIZ_GENERATION',
        status: 'PENDING',
        attempts: 0,
        maxAttempts: 3,
        payload: {
          quizId,
          materialId,
          userId,
          targetCount,
        },
      },
    });

    const quiz = await tx.quiz.create({
      data: {
        id: quizId,
        userId,
        materialId,
        title: `Kuis: ${material.title}`,
        status: 'QUEUED',
        targetCount,
        activeJobId: job.id,
      },
    });

    await tx.outboxEvent.create({
      data: {
        eventType: 'AI_QUIZ_REQUESTED',
        aggregateId: job.id,
        payload: {
          jobId: job.id,
          quizId: quiz.id,
          materialId,
          userId,
          targetCount,
        },
      },
    });

    dispatchOutboxEvents().catch(() => {});

    return {
      quizId: quiz.id,
      jobId: job.id,
      message: 'Pembuatan kuis sedang diproses',
    };
  });
}

export async function startOrResumeQuizAttempt(
  userId: string,
  quizId: string
): Promise<StartQuizAttemptResponse> {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      material: { select: { deletedAt: true } },
      questions: { orderBy: { orderIndex: 'asc' } },
    },
  });

  if (!quiz || (quiz.material && quiz.material.deletedAt !== null)) {
    throw createError(404, 'NOT_FOUND', 'Kuis tidak ditemukan');
  }
  if (quiz.userId !== userId) {
    throw createError(403, 'FORBIDDEN', 'Anda tidak memiliki akses ke kuis ini');
  }
  if (quiz.status !== 'READY') {
    throw createError(400, 'QUIZ_NOT_READY', 'Kuis belum siap dikerjakan.');
  }

  // Look for existing unfinished attempt or create new one
  let attempt = await prisma.quizAttempt.findFirst({
    where: {
      quizId,
      userId,
      submittedAt: null,
    },
    include: {
      answers: true,
    },
  });

  if (!attempt) {
    attempt = await prisma.quizAttempt.create({
      data: {
        quizId,
        userId,
        totalQuestions: quiz.questions.length,
      },
      include: {
        answers: true,
      },
    });
  }

  // Map client questions WITHOUT leaking correctIndex or explanation
  const questions: ClientQuizQuestion[] = quiz.questions.map((q) => ({
    id: q.id,
    quizId: q.quizId,
    question: q.question,
    options: q.options,
    orderIndex: q.orderIndex,
  }));

  const existingAnswers: Record<string, number> = {};
  if (attempt.answers) {
    for (const ans of attempt.answers) {
      if (ans.selectedIndex !== null) {
        existingAnswers[ans.questionId] = ans.selectedIndex;
      }
    }
  }

  return {
    attemptId: attempt.id,
    quizId: quiz.id,
    materialId: quiz.materialId,
    title: quiz.title,
    totalQuestions: quiz.questions.length,
    questions,
    existingAnswers,
  };
}

export async function saveQuizDraftAnswers(
  userId: string,
  attemptId: string,
  answers: { questionId: string; selectedIndex: number | null }[]
): Promise<{ success: boolean; savedCount: number }> {
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      quiz: {
        include: {
          material: { select: { deletedAt: true } },
          questions: { select: { id: true } },
        },
      },
    },
  });

  if (!attempt || (attempt.quiz.material && attempt.quiz.material.deletedAt !== null)) {
    throw createError(404, 'NOT_FOUND', 'Sesi pengerjaan kuis tidak ditemukan');
  }
  if (attempt.userId !== userId) {
    throw createError(403, 'FORBIDDEN', 'Anda tidak memiliki akses ke sesi pengerjaan kuis ini');
  }
  if (attempt.submittedAt !== null) {
    throw createError(400, 'ATTEMPT_ALREADY_SUBMITTED', 'Kuis sudah disubmit dan tidak dapat diubah.');
  }

  const validQuestionIds = new Set(attempt.quiz.questions.map((q) => q.id));

  await prisma.$transaction(async (tx) => {
    for (const ans of answers) {
      if (!validQuestionIds.has(ans.questionId)) continue;

      if (ans.selectedIndex === null) {
        await tx.quizAttemptAnswer.deleteMany({
          where: { attemptId, questionId: ans.questionId },
        });
      } else {
        await tx.quizAttemptAnswer.upsert({
          where: {
            attemptId_questionId: {
              attemptId,
              questionId: ans.questionId,
            },
          },
          update: {
            selectedIndex: ans.selectedIndex,
          },
          create: {
            attemptId,
            questionId: ans.questionId,
            selectedIndex: ans.selectedIndex,
            isCorrect: false,
          },
        });
      }
    }
  });

  return { success: true, savedCount: answers.length };
}

export async function submitQuizAttempt(
  userId: string,
  attemptId: string,
  userAnswers: { questionId: string; selectedIndex: number | null }[]
): Promise<QuizAttemptResponse> {
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      quiz: {
        include: {
          material: { select: { deletedAt: true } },
          questions: { orderBy: { orderIndex: 'asc' } },
        },
      },
      answers: true,
    },
  });

  if (!attempt || (attempt.quiz.material && attempt.quiz.material.deletedAt !== null)) {
    throw createError(404, 'NOT_FOUND', 'Sesi pengerjaan kuis tidak ditemukan');
  }
  if (attempt.userId !== userId) {
    throw createError(403, 'FORBIDDEN', 'Anda tidak memiliki akses ke sesi pengerjaan kuis ini');
  }

  // If already submitted (idempotent submission support), return existing evaluation
  if (attempt.submittedAt !== null) {
    return getQuizAttemptResult(userId, attemptId);
  }

  const questions = attempt.quiz.questions;

  // Calculate score on server
  let correctCount = 0;
  const answerRecords: {
    questionId: string;
    selectedIndex: number | null;
    isCorrect: boolean;
  }[] = [];

  for (const q of questions) {
    const userAns = userAnswers.find((a) => a.questionId === q.id);
    const selectedIdx = userAns?.selectedIndex ?? null;
    const isCorrect = selectedIdx !== null && selectedIdx === q.correctIndex;

    if (isCorrect) correctCount++;
    answerRecords.push({
      questionId: q.id,
      selectedIndex: selectedIdx,
      isCorrect,
    });
  }

  const totalQuestions = questions.length;
  const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100 * 10) / 10 : 0;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // Delete any draft answers
    await tx.quizAttemptAnswer.deleteMany({ where: { attemptId } });

    // Insert scored answers
    await tx.quizAttemptAnswer.createMany({
      data: answerRecords.map((a) => ({
        attemptId,
        questionId: a.questionId,
        selectedIndex: a.selectedIndex,
        isCorrect: a.isCorrect,
      })),
    });

    // Update attempt
    await tx.quizAttempt.update({
      where: { id: attemptId },
      data: {
        score,
        totalQuestions,
        correctAnswersCount: correctCount,
        submittedAt: now,
      },
    });
  });

  return getQuizAttemptResult(userId, attemptId);
}

export async function getQuizAttemptResult(
  userId: string,
  attemptId: string
): Promise<QuizAttemptResponse> {
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      quiz: {
        include: {
          material: { select: { deletedAt: true } },
          questions: { orderBy: { orderIndex: 'asc' } },
        },
      },
      answers: true,
    },
  });

  if (!attempt || (attempt.quiz.material && attempt.quiz.material.deletedAt !== null)) {
    throw createError(404, 'NOT_FOUND', 'Hasil pengerjaan kuis tidak ditemukan');
  }
  if (attempt.userId !== userId) {
    throw createError(403, 'FORBIDDEN', 'Anda tidak memiliki akses ke hasil kuis ini');
  }
  if (!attempt.submittedAt) {
    throw createError(400, 'ATTEMPT_NOT_SUBMITTED', 'Kuis belum disubmit.');
  }

  const answerMap = new Map(attempt.answers.map((a) => [a.questionId, a]));

  const completedQuestions: CompletedQuizQuestion[] = attempt.quiz.questions.map((q) => {
    const ans = answerMap.get(q.id);
    return {
      id: q.id,
      quizId: q.quizId,
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      pageReferences: q.pageReferences,
      orderIndex: q.orderIndex,
      userSelectedIndex: ans?.selectedIndex ?? null,
      isCorrect: ans?.isCorrect ?? false,
    };
  });

  return {
    id: attempt.id,
    quizId: attempt.quizId,
    userId: attempt.userId,
    score: attempt.score,
    totalQuestions: attempt.totalQuestions,
    correctAnswersCount: attempt.correctAnswersCount,
    submittedAt: attempt.submittedAt.toISOString(),
    questions: completedQuestions,
  };
}
