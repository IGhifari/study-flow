import {
  FlashcardSet,
  Flashcard,
  Quiz,
  StartQuizAttemptResponse,
  QuizAttemptResponse,
} from '@studyflow/shared';
import { authFetch } from './auth-client';

export class LearningApiError extends Error {
  code?: string;
  statusCode?: number;

  constructor(message: string, code?: string, statusCode?: number) {
    super(message);
    this.name = 'LearningApiError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

// ==========================================
// Flashcards API Client
// ==========================================

export async function getMaterialFlashcards(materialId: string): Promise<{ sets: FlashcardSet[] }> {
  const res = await authFetch(`/api/materials/${materialId}/flashcard-sets`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new LearningApiError(
      errorData.error?.message || 'Gagal memuat flashcards',
      errorData.error?.code,
      res.status
    );
  }
  return res.json();
}

export async function generateFlashcards(
  materialId: string,
  targetCount: 5 | 10 | 20 = 10
): Promise<{ setId: string; jobId: string; message: string }> {
  const res = await authFetch(`/api/materials/${materialId}/flashcard-sets`, {
    method: 'POST',
    body: JSON.stringify({ targetCount }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new LearningApiError(
      errorData.error?.message || 'Gagal meminta pembuatan flashcards',
      errorData.error?.code,
      res.status
    );
  }
  return res.json();
}

export async function updateFlashcardMastery(
  cardId: string,
  masteryStatus: 'UNRATED' | 'NEED_REVIEW' | 'MASTERED'
): Promise<Flashcard> {
  const res = await authFetch(`/api/flashcards/${cardId}`, {
    method: 'PATCH',
    body: JSON.stringify({ masteryStatus }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new LearningApiError(
      errorData.error?.message || 'Gagal memperbarui status pemahaman kartu',
      errorData.error?.code,
      res.status
    );
  }
  return res.json();
}

// ==========================================
// Quiz API Client
// ==========================================

export async function getMaterialQuizzes(materialId: string): Promise<{ quizzes: Quiz[] }> {
  const res = await authFetch(`/api/materials/${materialId}/quizzes`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new LearningApiError(
      errorData.error?.message || 'Gagal memuat kuis',
      errorData.error?.code,
      res.status
    );
  }
  return res.json();
}

export async function generateQuiz(
  materialId: string,
  targetCount: 5 | 10 = 5
): Promise<{ quizId: string; jobId: string; message: string }> {
  const res = await authFetch(`/api/materials/${materialId}/quizzes`, {
    method: 'POST',
    body: JSON.stringify({ targetCount }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new LearningApiError(
      errorData.error?.message || 'Gagal meminta pembuatan kuis',
      errorData.error?.code,
      res.status
    );
  }
  return res.json();
}

export async function startQuizAttempt(quizId: string): Promise<StartQuizAttemptResponse> {
  const res = await authFetch(`/api/quizzes/${quizId}/attempts`, {
    method: 'POST',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new LearningApiError(
      errorData.error?.message || 'Gagal memulai pengerjaan kuis',
      errorData.error?.code,
      res.status
    );
  }
  return res.json();
}

export async function saveQuizDraftAnswers(
  attemptId: string,
  answers: { questionId: string; selectedIndex: number | null }[]
): Promise<{ success: boolean; savedCount: number }> {
  const res = await authFetch(`/api/attempts/${attemptId}/answers`, {
    method: 'PATCH',
    body: JSON.stringify({ answers }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new LearningApiError(
      errorData.error?.message || 'Gagal menyimpan jawaban sementara kuis',
      errorData.error?.code,
      res.status
    );
  }
  return res.json();
}

export async function submitQuizAttempt(
  attemptId: string,
  answers: { questionId: string; selectedIndex: number | null }[]
): Promise<QuizAttemptResponse> {
  const res = await authFetch(`/api/attempts/${attemptId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new LearningApiError(
      errorData.error?.message || 'Gagal mengirimkan jawaban kuis',
      errorData.error?.code,
      res.status
    );
  }
  return res.json();
}

export async function getQuizAttemptResult(attemptId: string): Promise<QuizAttemptResponse> {
  const res = await authFetch(`/api/attempts/${attemptId}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new LearningApiError(
      errorData.error?.message || 'Gagal memuat hasil kuis',
      errorData.error?.code,
      res.status
    );
  }
  return res.json();
}
