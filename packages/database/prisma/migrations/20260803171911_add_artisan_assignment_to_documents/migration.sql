-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "artisanAssignmentId" TEXT;

-- CreateIndex
CREATE INDEX "documents_artisanAssignmentId_idx" ON "documents"("artisanAssignmentId");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_artisanAssignmentId_fkey" FOREIGN KEY ("artisanAssignmentId") REFERENCES "artisan_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
