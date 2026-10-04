-- Milestone 5: Materials, ProcessingJobs, OutboxEvents, and Quotas (additive; does not modify existing migrations)

-- CreateEnum
CREATE TYPE "MaterialStatus" AS ENUM ('UPLOADING', 'QUEUED', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ProcessingJobType" AS ENUM ('DOCUMENT_EXTRACTION', 'DOCUMENT_CLEANUP');

-- CreateEnum
CREATE TYPE "ProcessingJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "materials" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL DEFAULT 'application/pdf',
    "bytes" INTEGER NOT NULL,
    "page_count" INTEGER,
    "status" "MaterialStatus" NOT NULL DEFAULT 'UPLOADING',
    "error_code" TEXT,
    "error_message" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_pages" (
    "id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "page_number" INTEGER NOT NULL,
    "extracted_text" TEXT NOT NULL,
    "character_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_jobs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "material_id" TEXT,
    "type" "ProcessingJobType" NOT NULL DEFAULT 'DOCUMENT_EXTRACTION',
    "status" "ProcessingJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "idempotency_key" TEXT,
    "error_message" TEXT,
    "error_code" TEXT,
    "payload" JSONB,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processing_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_usages" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "used_bytes" BIGINT NOT NULL DEFAULT 0,
    "reserved_bytes" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_upload_counters" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "upload_date" TEXT NOT NULL,
    "upload_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_upload_counters_pkey" PRIMARY KEY ("id")
);

-- AlterTable Note: add material_id
ALTER TABLE "notes" ADD COLUMN "material_id" TEXT;

-- Unique and Indexes
CREATE UNIQUE INDEX "materials_storage_key_key" ON "materials"("storage_key");
CREATE UNIQUE INDEX "materials_id_user_id_key" ON "materials"("id", "user_id");
CREATE INDEX "materials_user_id_course_id_idx" ON "materials"("user_id", "course_id");
CREATE INDEX "materials_user_id_status_idx" ON "materials"("user_id", "status");
CREATE INDEX "materials_course_id_idx" ON "materials"("course_id");

CREATE UNIQUE INDEX "material_pages_material_id_page_number_key" ON "material_pages"("material_id", "page_number");
CREATE INDEX "material_pages_material_id_idx" ON "material_pages"("material_id");

CREATE UNIQUE INDEX "processing_jobs_idempotency_key_key" ON "processing_jobs"("idempotency_key");
CREATE INDEX "processing_jobs_user_id_status_idx" ON "processing_jobs"("user_id", "status");
CREATE INDEX "processing_jobs_material_id_idx" ON "processing_jobs"("material_id");

CREATE INDEX "outbox_events_status_created_at_idx" ON "outbox_events"("status", "created_at");

CREATE UNIQUE INDEX "storage_usages_user_id_key" ON "storage_usages"("user_id");

CREATE UNIQUE INDEX "daily_upload_counters_user_id_upload_date_key" ON "daily_upload_counters"("user_id", "upload_date");
CREATE INDEX "daily_upload_counters_user_id_upload_date_idx" ON "daily_upload_counters"("user_id", "upload_date");

CREATE INDEX "notes_material_id_idx" ON "notes"("material_id");

-- Foreign Keys
ALTER TABLE "materials" ADD CONSTRAINT "materials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "materials" ADD CONSTRAINT "materials_course_id_user_id_fkey" FOREIGN KEY ("course_id", "user_id") REFERENCES "courses"("id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "material_pages" ADD CONSTRAINT "material_pages_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "storage_usages" ADD CONSTRAINT "storage_usages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "daily_upload_counters" ADD CONSTRAINT "daily_upload_counters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notes" ADD CONSTRAINT "notes_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;
