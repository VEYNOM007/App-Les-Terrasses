-- AlterTable
ALTER TABLE "survey_responses" ADD COLUMN IF NOT EXISTS "otherAnswers" JSONB;
