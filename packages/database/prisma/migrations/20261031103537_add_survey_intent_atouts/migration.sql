-- AlterTable
ALTER TABLE "survey_responses" ADD COLUMN     "intentAfter" INTEGER,
ADD COLUMN     "intentBefore" INTEGER,
ADD COLUMN     "remainingBlockers" TEXT,
ADD COLUMN     "topAtouts" TEXT[];
