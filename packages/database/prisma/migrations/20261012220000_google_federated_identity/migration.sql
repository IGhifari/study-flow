-- AlterTable: Make password_hash nullable for federated users without local passwords
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

-- CreateTable: federated_identities
CREATE TABLE "federated_identities" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "federated_identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique provider + subject per federated identity
CREATE UNIQUE INDEX "federated_identities_provider_subject_key" ON "federated_identities"("provider", "subject");

-- CreateIndex: index for lookup by user_id
CREATE INDEX "federated_identities_user_id_idx" ON "federated_identities"("user_id");

-- AddForeignKey: cascade on user deletion
ALTER TABLE "federated_identities" ADD CONSTRAINT "federated_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
