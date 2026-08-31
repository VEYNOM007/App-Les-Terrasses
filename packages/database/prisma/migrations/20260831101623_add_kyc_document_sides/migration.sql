-- CreateEnum
CREATE TYPE "DocumentSide" AS ENUM ('RECTO', 'VERSO');

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "kycBatchId" TEXT,
ADD COLUMN     "side" "DocumentSide";

-- CreateIndex
CREATE INDEX "documents_kycBatchId_idx" ON "documents"("kycBatchId");
