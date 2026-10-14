-- CreateEnum
CREATE TYPE "PinnedItemType" AS ENUM ('MATERIAL', 'NOTE');

-- CreateTable
CREATE TABLE "pinned_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "PinnedItemType" NOT NULL,
    "material_id" TEXT,
    "note_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pinned_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pinned_items_item_check" CHECK (
        ("material_id" IS NOT NULL AND "note_id" IS NULL AND "type" = 'MATERIAL') OR
        ("note_id" IS NOT NULL AND "material_id" IS NULL AND "type" = 'NOTE')
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "pinned_items_user_id_material_id_key" ON "pinned_items"("user_id", "material_id");

-- CreateIndex
CREATE UNIQUE INDEX "pinned_items_user_id_note_id_key" ON "pinned_items"("user_id", "note_id");

-- CreateIndex
CREATE INDEX "pinned_items_user_id_created_at_idx" ON "pinned_items"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "pinned_items_user_id_type_idx" ON "pinned_items"("user_id", "type");

-- AddForeignKey
ALTER TABLE "pinned_items" ADD CONSTRAINT "pinned_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pinned_items" ADD CONSTRAINT "pinned_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pinned_items" ADD CONSTRAINT "pinned_items_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
