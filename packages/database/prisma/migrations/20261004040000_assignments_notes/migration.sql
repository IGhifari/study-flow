-- Milestone 4: Assignments & Notes (additive; does not modify existing tables)

-- CreateEnum
CREATE TYPE "AssignmentPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- CreateTable
CREATE TABLE "assignments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "due_date" TIMESTAMP(3) NOT NULL,
    "priority" "AssignmentPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "AssignmentStatus" NOT NULL DEFAULT 'TODO',
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex on courses for composite FK target
CREATE UNIQUE INDEX "courses_id_user_id_key" ON "courses"("id", "user_id");

-- CreateIndex on assignments
CREATE INDEX "assignments_user_id_due_date_idx" ON "assignments"("user_id", "due_date");
CREATE INDEX "assignments_user_id_status_idx" ON "assignments"("user_id", "status");
CREATE INDEX "assignments_course_id_idx" ON "assignments"("course_id");

-- CreateIndex on notes
CREATE INDEX "notes_user_id_updated_at_idx" ON "notes"("user_id", "updated_at");
CREATE INDEX "notes_course_id_idx" ON "notes"("course_id");

-- AddForeignKey to users
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: composite FK guarantees assignment/note owner is strictly identical to course owner
-- and ON DELETE RESTRICT prevents deleting Course while it has assignments or notes
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_course_id_user_id_fkey" FOREIGN KEY ("course_id", "user_id") REFERENCES "courses"("id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notes" ADD CONSTRAINT "notes_course_id_user_id_fkey" FOREIGN KEY ("course_id", "user_id") REFERENCES "courses"("id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
