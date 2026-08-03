-- CreateEnum
CREATE TYPE "ContractSignerType" AS ENUM ('PROPRIETAIRE', 'ADMIN');

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "signedFileUrl" TEXT;

-- CreateTable
CREATE TABLE "contract_signatures" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "signerType" "ContractSignerType" NOT NULL,
    "signerUserId" TEXT NOT NULL,
    "signatureImageUrl" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_signatures_documentId_idx" ON "contract_signatures"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "contract_signatures_documentId_signerType_key" ON "contract_signatures"("documentId", "signerType");

-- AddForeignKey
ALTER TABLE "contract_signatures" ADD CONSTRAINT "contract_signatures_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_signatures" ADD CONSTRAINT "contract_signatures_signerUserId_fkey" FOREIGN KEY ("signerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
