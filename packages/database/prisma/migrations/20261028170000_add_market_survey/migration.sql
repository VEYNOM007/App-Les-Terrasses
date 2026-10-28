-- CreateTable
CREATE TABLE "survey_responses" (
    "id" TEXT NOT NULL,
    "source" TEXT,
    "residence" TEXT NOT NULL,
    "togoLink" TEXT NOT NULL,
    "projectGoal" TEXT NOT NULL,
    "preference" TEXT NOT NULL,
    "whyText" TEXT,
    "budget" TEXT NOT NULL,
    "budgetCurrency" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "decisionMakers" TEXT[],
    "blockers" TEXT[],
    "reassurances" TEXT[],
    "experienceText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_contacts" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "email" TEXT,
    "whatsapp" TEXT,
    "consent" BOOLEAN NOT NULL DEFAULT false,
    "consentAt" TIMESTAMP(3),
    "consentVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "survey_responses_source_idx" ON "survey_responses"("source");

-- CreateIndex
CREATE INDEX "survey_responses_createdAt_idx" ON "survey_responses"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "survey_contacts_responseId_key" ON "survey_contacts"("responseId");

-- CreateIndex
CREATE INDEX "survey_contacts_email_idx" ON "survey_contacts"("email");

-- AddForeignKey
ALTER TABLE "survey_contacts" ADD CONSTRAINT "survey_contacts_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "survey_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
