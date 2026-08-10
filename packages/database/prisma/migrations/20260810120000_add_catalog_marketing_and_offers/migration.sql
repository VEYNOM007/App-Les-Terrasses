-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('PHOTO', 'PLAN', 'RENDU_3D');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "marketingInfo" JSONB,
ADD COLUMN     "views" JSONB;

-- AlterTable
ALTER TABLE "units" ADD COLUMN     "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "marketingDescription" TEXT,
ADD COLUMN     "virtualTourUrl" TEXT;

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN     "offerLabel" TEXT,
ADD COLUMN     "offerPrice" DECIMAL(14,2);

-- CreateTable
CREATE TABLE "unit_media" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unit_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "unit_media_unitId_type_idx" ON "unit_media"("unitId", "type");

-- CreateIndex
CREATE INDEX "unit_media_unitId_sortOrder_idx" ON "unit_media"("unitId", "sortOrder");

-- AddForeignKey
ALTER TABLE "unit_media" ADD CONSTRAINT "unit_media_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
