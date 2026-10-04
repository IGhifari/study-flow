-- Milestone 3: Semester & Course (additive; does not modify existing auth tables)

-- CreateTable
CREATE TABLE "semesters" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "academic_year" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "semesters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "semester_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "lecturer" TEXT,
    "description" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "semesters_user_id_created_at_idx" ON "semesters"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "semesters_id_user_id_key" ON "semesters"("id", "user_id");

-- CreateIndex
CREATE INDEX "courses_user_id_semester_id_idx" ON "courses"("user_id", "semester_id");

-- CreateIndex
CREATE INDEX "courses_user_id_name_idx" ON "courses"("user_id", "name");

-- AddForeignKey
ALTER TABLE "semesters" ADD CONSTRAINT "semesters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: composite FK guarantees courses.user_id = owning semester's user_id
ALTER TABLE "courses" ADD CONSTRAINT "courses_semester_id_user_id_fkey" FOREIGN KEY ("semester_id", "user_id") REFERENCES "semesters"("id", "user_id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- Invariant: at most one active semester per user (partial unique index; not expressible in Prisma schema)
CREATE UNIQUE INDEX "semesters_one_active_per_user" ON "semesters"("user_id") WHERE "is_active" = true;

-- Invariant: an archived semester can never be the active semester
ALTER TABLE "semesters" ADD CONSTRAINT "semesters_active_not_archived" CHECK (NOT ("is_active" AND "archived_at" IS NOT NULL));
