import { z } from 'zod';

// ==========================================
// Flashcard Contracts (FR-07)
// ==========================================

export const FlashcardSetStatusEnum = z.enum([
  'QUEUED',
  'PROCESSING',
  'READY',
  'FAILED',
]);
export type FlashcardSetStatus = z.infer<typeof FlashcardSetStatusEnum>;

export const FlashcardMasteryStatusEnum = z.enum([
  'UNRATED',
  'NEED_REVIEW',
  'MASTERED',
]);
export type FlashcardMasteryStatus = z.infer<typeof FlashcardMasteryStatusEnum>;

export const FlashcardItemOutputSchema = z.object({
  front: z.string().min(1, 'Pertanyaan/istilah tidak boleh kosong'),
  back: z.string().min(1, 'Jawaban/penjelasan tidak boleh kosong'),
  pageReferences: z.array(z.number().int().positive()).min(1, 'Rujukan halaman harus diisi'),
});
export type FlashcardItemOutput = z.infer<typeof FlashcardItemOutputSchema>;

export const FlashcardSetStructuredOutputSchema = z.object({
  title: z.string().min(1),
  cards: z.array(FlashcardItemOutputSchema).min(1),
});
export type FlashcardSetStructuredOutput = z.infer<typeof FlashcardSetStructuredOutputSchema>;

export const FlashcardSchema = z.object({
  id: z.string(),
  setId: z.string(),
  front: z.string(),
  back: z.string(),
  pageReferences: z.array(z.number().int().positive()),
  orderIndex: z.number().int().nonnegative(),
  masteryStatus: FlashcardMasteryStatusEnum,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Flashcard = z.infer<typeof FlashcardSchema>;

export const FlashcardSetSchema = z.object({
  id: z.string(),
  userId: z.string(),
  materialId: z.string(),
  title: z.string(),
  cardCount: z.number().int().nonnegative(),
  status: FlashcardSetStatusEnum,
  targetCount: z.number().int().positive(),
  activeJobId: z.string().nullable().optional(),
  errorCode: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  cards: z.array(FlashcardSchema).optional(),
});
export type FlashcardSet = z.infer<typeof FlashcardSetSchema>;

export const GenerateFlashcardsInputSchema = z.object({
  targetCount: z.union([z.literal(5), z.literal(10), z.literal(20)]).default(10),
});
export type GenerateFlashcardsInput = z.infer<typeof GenerateFlashcardsInputSchema>;

export const UpdateFlashcardMasteryInputSchema = z.object({
  masteryStatus: FlashcardMasteryStatusEnum,
});
export type UpdateFlashcardMasteryInput = z.infer<typeof UpdateFlashcardMasteryInputSchema>;

export const FlashcardSetResponseSchema = z.object({
  set: FlashcardSetSchema.nullable(),
  cards: z.array(FlashcardSchema),
});
export type FlashcardSetResponse = z.infer<typeof FlashcardSetResponseSchema>;

// ==========================================
// Quiz Contracts (FR-08)
// ==========================================

export const QuizStatusEnum = z.enum([
  'QUEUED',
  'PROCESSING',
  'READY',
  'FAILED',
]);
export type QuizStatus = z.infer<typeof QuizStatusEnum>;

export const QuizQuestionOutputSchema = z.object({
  question: z.string().min(1, 'Pertanyaan tidak boleh kosong'),
  options: z.array(z.string().min(1)).length(4, 'Harus memiliki tepat 4 opsi jawaban'),
  correctIndex: z.number().int().min(0).max(3, 'Indeks jawaban benar harus antara 0 dan 3'),
  explanation: z.string().min(1, 'Pembahasan jawaban harus diisi'),
  pageReferences: z.array(z.number().int().positive()).min(1, 'Rujukan halaman harus diisi'),
});
export type QuizQuestionOutput = z.infer<typeof QuizQuestionOutputSchema>;

export const QuizStructuredOutputSchema = z.object({
  title: z.string().min(1),
  questions: z.array(QuizQuestionOutputSchema).min(1),
});
export type QuizStructuredOutput = z.infer<typeof QuizStructuredOutputSchema>;

// Client question during active attempt (WITHOUT correctIndex or explanation to prevent leaks)
export const ClientQuizQuestionSchema = z.object({
  id: z.string(),
  quizId: z.string(),
  question: z.string(),
  options: z.array(z.string()),
  orderIndex: z.number().int().nonnegative(),
});
export type ClientQuizQuestion = z.infer<typeof ClientQuizQuestionSchema>;

// Question with explanation and answer (only available after submission)
export const CompletedQuizQuestionSchema = z.object({
  id: z.string(),
  quizId: z.string(),
  question: z.string(),
  options: z.array(z.string()),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string(),
  pageReferences: z.array(z.number().int().positive()),
  orderIndex: z.number().int().nonnegative(),
  userSelectedIndex: z.number().int().min(0).max(3).nullable().optional(),
  isCorrect: z.boolean().optional(),
});
export type CompletedQuizQuestion = z.infer<typeof CompletedQuizQuestionSchema>;

export const QuizSchema = z.object({
  id: z.string(),
  userId: z.string(),
  materialId: z.string(),
  title: z.string(),
  questionCount: z.number().int().nonnegative(),
  status: QuizStatusEnum,
  targetCount: z.number().int().positive(),
  activeJobId: z.string().nullable().optional(),
  errorCode: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Quiz = z.infer<typeof QuizSchema>;

export const GenerateQuizInputSchema = z.object({
  targetCount: z.union([z.literal(5), z.literal(10)]).default(5),
});
export type GenerateQuizInput = z.infer<typeof GenerateQuizInputSchema>;

export const SubmitQuizAnswerItemSchema = z.object({
  questionId: z.string(),
  selectedIndex: z.number().int().min(0).max(3).nullable(),
});
export type SubmitQuizAnswerItem = z.infer<typeof SubmitQuizAnswerItemSchema>;

export const SubmitQuizAttemptInputSchema = z.object({
  answers: z.array(SubmitQuizAnswerItemSchema),
});
export type SubmitQuizAttemptInput = z.infer<typeof SubmitQuizAttemptInputSchema>;

export const QuizAttemptResponseSchema = z.object({
  id: z.string(),
  quizId: z.string(),
  userId: z.string(),
  score: z.number(), // 0 to 100
  totalQuestions: z.number().int().positive(),
  correctAnswersCount: z.number().int().nonnegative(),
  submittedAt: z.string(),
  questions: z.array(CompletedQuizQuestionSchema),
});
export type QuizAttemptResponse = z.infer<typeof QuizAttemptResponseSchema>;

export const SaveQuizDraftAnswersInputSchema = z.object({
  answers: z.array(SubmitQuizAnswerItemSchema),
});
export type SaveQuizDraftAnswersInput = z.infer<typeof SaveQuizDraftAnswersInputSchema>;

export const StartQuizAttemptResponseSchema = z.object({
  attemptId: z.string(),
  quizId: z.string(),
  materialId: z.string(),
  title: z.string(),
  totalQuestions: z.number().int().positive(),
  questions: z.array(ClientQuizQuestionSchema),
  existingAnswers: z.record(z.string(), z.number().int().min(0).max(3)).optional(),
});
export type StartQuizAttemptResponse = z.infer<typeof StartQuizAttemptResponseSchema>;

