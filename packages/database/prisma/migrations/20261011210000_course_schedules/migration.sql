-- Milestone: Course Schedules (additive; does not modify or delete existing tables)

-- CreateTable
CREATE TABLE "course_schedules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "room" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "course_schedules_course_id_day_of_week_start_time_end_time_key" ON "course_schedules"("course_id", "day_of_week", "start_time", "end_time");

-- CreateIndex
CREATE INDEX "course_schedules_user_id_day_of_week_start_time_idx" ON "course_schedules"("user_id", "day_of_week", "start_time");

-- CreateIndex
CREATE INDEX "course_schedules_course_id_idx" ON "course_schedules"("course_id");

-- AddForeignKey
ALTER TABLE "course_schedules" ADD CONSTRAINT "course_schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: composite foreign key guarantees course_schedules.user_id = owning course's user_id
ALTER TABLE "course_schedules" ADD CONSTRAINT "course_schedules_course_id_user_id_fkey" FOREIGN KEY ("course_id", "user_id") REFERENCES "courses"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;
