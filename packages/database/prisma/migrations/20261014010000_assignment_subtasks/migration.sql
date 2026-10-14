-- CreateTable
CREATE TABLE "assignment_subtasks" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignment_subtasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assignment_subtasks_assignment_id_order_idx" ON "assignment_subtasks"("assignment_id", "order");

-- AddForeignKey
ALTER TABLE "assignment_subtasks" ADD CONSTRAINT "assignment_subtasks_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
