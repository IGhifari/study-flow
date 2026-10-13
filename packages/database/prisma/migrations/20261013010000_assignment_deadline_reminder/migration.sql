-- AlterTable
ALTER TABLE "users" ADD COLUMN "reminder_email_deadline" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
CREATE TYPE "ReminderLogStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'SKIPPED', 'FAILED');

-- CreateTable
CREATE TABLE "assignment_reminder_logs" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reminder_type" TEXT NOT NULL DEFAULT 'D_MINUS_1',
    "deadline" TIMESTAMP(3) NOT NULL,
    "status" "ReminderLogStatus" NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignment_reminder_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assignment_reminder_logs_assignment_id_reminder_type_deadline_key" ON "assignment_reminder_logs"("assignment_id", "reminder_type", "deadline");

-- CreateIndex
CREATE INDEX "assignment_reminder_logs_user_id_status_idx" ON "assignment_reminder_logs"("user_id", "status");

-- CreateIndex
CREATE INDEX "assignment_reminder_logs_status_deadline_idx" ON "assignment_reminder_logs"("status", "deadline");

-- CreateIndex
CREATE INDEX "assignments_status_due_date_idx" ON "assignments"("status", "due_date");

-- AddForeignKey
ALTER TABLE "assignment_reminder_logs" ADD CONSTRAINT "assignment_reminder_logs_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_reminder_logs" ADD CONSTRAINT "assignment_reminder_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
