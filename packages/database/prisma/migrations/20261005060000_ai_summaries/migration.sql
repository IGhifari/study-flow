-- AlterEnum
ALTER TYPE "ProcessingJobType" ADD VALUE 'AI_SUMMARY_GENERATION';

-- CreateEnum
CREATE TYPE "SummaryStatus" AS ENUM ('QUEUED', 'PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "material_summaries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "status" "SummaryStatus" NOT NULL DEFAULT 'QUEUED',
    "title" TEXT,
    "overview" TEXT,
    "key_concepts" JSONB,
    "sections" JSONB,
    "key_terms" JSONB,
    "limitations" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'gemini',
    "model" TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
    "prompt_version" TEXT NOT NULL DEFAULT 'v1',
    "source_page_count" INTEGER NOT NULL DEFAULT 0,
    "source_character_count" INTEGER NOT NULL DEFAULT 0,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "duration_ms" INTEGER,
    "active_job_id" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usages" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "daily_generation_count" INTEGER NOT NULL DEFAULT 0,
    "last_reset_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active_jobs_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_usages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "material_summaries_material_id_key" ON "material_summaries"("material_id");

-- CreateIndex
CREATE INDEX "material_summaries_user_id_status_idx" ON "material_summaries"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ai_usages_user_id_key" ON "ai_usages"("user_id");

-- AddForeignKey
ALTER TABLE "material_summaries" ADD CONSTRAINT "material_summaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_summaries" ADD CONSTRAINT "material_summaries_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usages" ADD CONSTRAINT "ai_usages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
