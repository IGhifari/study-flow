-- CreateEnum
CREATE TYPE "FlashcardSetStatus" AS ENUM ('QUEUED', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "FlashcardMasteryStatus" AS ENUM ('UNRATED', 'NEED_REVIEW', 'MASTERED');

-- CreateEnum
CREATE TYPE "QuizStatus" AS ENUM ('QUEUED', 'PROCESSING', 'READY', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProcessingJobType" ADD VALUE 'AI_FLASHCARD_GENERATION';
ALTER TYPE "ProcessingJobType" ADD VALUE 'AI_QUIZ_GENERATION';

-- CreateTable
CREATE TABLE "flashcard_sets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "card_count" INTEGER NOT NULL DEFAULT 0,
    "status" "FlashcardSetStatus" NOT NULL DEFAULT 'QUEUED',
    "target_count" INTEGER NOT NULL DEFAULT 10,
    "active_job_id" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flashcard_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flashcards" (
    "id" TEXT NOT NULL,
    "set_id" TEXT NOT NULL,
    "front" TEXT NOT NULL,
    "back" TEXT NOT NULL,
    "page_references" INTEGER[],
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "mastery_status" "FlashcardMasteryStatus" NOT NULL DEFAULT 'UNRATED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flashcards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quizzes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "question_count" INTEGER NOT NULL DEFAULT 0,
    "status" "QuizStatus" NOT NULL DEFAULT 'QUEUED',
    "target_count" INTEGER NOT NULL DEFAULT 5,
    "active_job_id" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_questions" (
    "id" TEXT NOT NULL,
    "quiz_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT[],
    "correct_index" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL,
    "page_references" INTEGER[],
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" TEXT NOT NULL,
    "quiz_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_questions" INTEGER NOT NULL DEFAULT 0,
    "correct_answers_count" INTEGER NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempt_answers" (
    "id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "selected_index" INTEGER,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_attempt_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "flashcard_sets_user_id_material_id_idx" ON "flashcard_sets"("user_id", "material_id");

-- CreateIndex
CREATE INDEX "flashcard_sets_user_id_status_idx" ON "flashcard_sets"("user_id", "status");

-- CreateIndex
CREATE INDEX "flashcards_set_id_order_index_idx" ON "flashcards"("set_id", "order_index");

-- CreateIndex
CREATE INDEX "quizzes_user_id_material_id_idx" ON "quizzes"("user_id", "material_id");

-- CreateIndex
CREATE INDEX "quizzes_user_id_status_idx" ON "quizzes"("user_id", "status");

-- CreateIndex
CREATE INDEX "quiz_questions_quiz_id_order_index_idx" ON "quiz_questions"("quiz_id", "order_index");

-- CreateIndex
CREATE INDEX "quiz_attempts_user_id_quiz_id_idx" ON "quiz_attempts"("user_id", "quiz_id");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_attempt_answers_attempt_id_question_id_key" ON "quiz_attempt_answers"("attempt_id", "question_id");

-- AddForeignKey
ALTER TABLE "flashcard_sets" ADD CONSTRAINT "flashcard_sets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcard_sets" ADD CONSTRAINT "flashcard_sets_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "flashcard_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempt_answers" ADD CONSTRAINT "quiz_attempt_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "quiz_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempt_answers" ADD CONSTRAINT "quiz_attempt_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
