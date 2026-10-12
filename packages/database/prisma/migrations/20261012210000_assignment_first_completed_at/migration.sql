-- Milestone: Dashboard Activity Chart (first_completed_at tracking and indexes)
-- Additive nullable column, safe backfill, and performance indexes

-- AlterTable
ALTER TABLE "assignments" ADD COLUMN "first_completed_at" TIMESTAMP(3);

-- Backfill first_completed_at from completed_at for already completed assignments
UPDATE "assignments" SET "first_completed_at" = "completed_at" WHERE "completed_at" IS NOT NULL;

-- CreateIndex: index for activity chart query filtering by user_id and first_completed_at
CREATE INDEX "assignments_user_id_first_completed_at_idx" ON "assignments"("user_id", "first_completed_at");

-- CreateIndex: index for quiz attempts query filtering by user_id and submitted_at
CREATE INDEX "quiz_attempts_user_id_submitted_at_idx" ON "quiz_attempts"("user_id", "submitted_at");
