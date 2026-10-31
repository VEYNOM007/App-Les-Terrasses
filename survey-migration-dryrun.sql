-- Dry-run de la migration ADDITIVE sur une base jetable.
-- Vérifie : colonnes créées nulles, lignes existantes intactes, aucune perte.
\pset pager off

\echo '=== AVANT : colonnes existantes et nombre de lignes ==='
SELECT count(*) AS lignes_avant FROM survey_responses;

\echo '=== MIGRATION (transaction annulée) ==='
BEGIN;
ALTER TABLE "survey_responses"
  ADD COLUMN "intentAfter" INTEGER,
  ADD COLUMN "intentBefore" INTEGER,
  ADD COLUMN "remainingBlockers" TEXT,
  ADD COLUMN "topAtouts" TEXT[];

\echo '=== APRES : nouvelles colonnes ==='
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'survey_responses'
  AND column_name IN ('intentBefore','intentAfter','topAtouts','remainingBlockers')
ORDER BY column_name;

\echo '=== APRES : lignes existantes toujours présentes ==='
SELECT count(*) AS lignes_apres FROM survey_responses;

\echo '=== APRES : valeurs par défaut des réponses existantes (doivent être NULL) ==='
SELECT count(*) AS lignes_a_null
FROM survey_responses
WHERE "intentBefore" IS NULL
  AND "intentAfter" IS NULL
  AND "remainingBlockers" IS NULL
  AND "topAtouts" IS NULL;

ROLLBACK;
