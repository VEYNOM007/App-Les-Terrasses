-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedReason" TEXT;

-- CreateIndex
CREATE INDEX "documents_kycOwnerId_idx" ON "documents"("kycOwnerId");