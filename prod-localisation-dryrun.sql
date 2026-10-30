-- ============================================================================
-- DRY-RUN — Correction de localisation en PRODUCTION
-- ============================================================================
-- STATUT : NON EXÉCUTÉ. À exécuter uniquement après :
--   1. accord écrit explicite du propriétaire du projet
--   2. pg_dump complet de la base AVANT (voir commande en fin de fichier)
--   3. relecture de la section « AVANT » ci-dessous
--
-- Portée : remplace Baguida par Gbodjomé, retire « 5 min du Littoral »,
--          retire le titre foncier (RM 100/71) et remplace
--          « en vente sur plan (VEFA) » par « Projet à l'étude ».
-- Aucune migration historique n'est réécrite : uniquement les valeurs
-- courantes des tables projects et units.
-- ============================================================================

\pset pager off

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. AVANT — état exact constaté (scan lecture seule du 2026-10-30)
-- ---------------------------------------------------------------------------
\echo '=== AVANT : projects ==='
SELECT id, name, location, description, "marketingInfo"
FROM projects
WHERE id = 'cmt0ips4s00044xf04rryvdf8';

\echo '=== AVANT : units contenant Baguida ==='
SELECT id, "marketingDescription"
FROM units
WHERE lower(coalesce("marketingDescription", '')) LIKE '%baguida%'
ORDER BY id;


-- ---------------------------------------------------------------------------
-- 1. projects — colonnes simples
-- ---------------------------------------------------------------------------
-- name        : 'Les Terrasses de Baguida'                    -> 'Les Terrasses'
-- location    : 'Baguida, Lomé, Togo'                          -> 'Gbodjomé, Lomé'
-- description : 'Résidence sécurisée en vente sur plan (VEFA),
--                4 blocs R+4 à Baguida, Lomé.'
--               -> 'Projet à l''étude, 4 blocs R+4 à Gbodjomé, Lomé.'
UPDATE projects
SET
  name = 'Les Terrasses',
  location = 'Gbodjomé, Lomé',
  description = 'Projet à l''étude, 4 blocs R+4 à Gbodjomé, Lomé.'
WHERE id = 'cmt0ips4s00044xf04rryvdf8';


-- ---------------------------------------------------------------------------
-- 2. projects."marketingInfo" (JSONB) — name, location, titleDeed
-- ---------------------------------------------------------------------------
-- Avant : {"name": "Les Terrasses de Baguida",
--          "location": "Baguida, Lomé, Togo",
--          "titleDeed": "RM 100/71", ...}
-- Après : {"name": "Les Terrasses",
--          "location": "Gbodjomé, Lomé",
--          "titleDeed": "", ...}
--
-- titleDeed est vidé (et non supprimé) : le champ reste éditable côté admin
-- pour le jour où le notaire valide le titre. Aucun contrat ne le lit
-- (grep apps/api/src/modules/contract = 0 occurrence) et le site public le
-- masque déjà en mode étude de marché.
UPDATE projects
SET "marketingInfo" = jsonb_set(
      jsonb_set(
        jsonb_set(
          coalesce("marketingInfo", '{}'::jsonb),
          '{name}', to_jsonb('Les Terrasses'::text)
        ),
        '{location}', to_jsonb('Gbodjomé, Lomé'::text)
      ),
      '{titleDeed}', to_jsonb(''::text)
    )
WHERE id = 'cmt0ips4s00044xf04rryvdf8'
  AND "marketingInfo" IS NOT NULL;

-- Filet de sécurité : si marketingInfo contenait une description, on la nettoie.
UPDATE projects
SET "marketingInfo" = jsonb_set(
      "marketingInfo",
      '{description}',
      to_jsonb(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              "marketingInfo"->>'description',
              '\m(à )?5 min du Littoral\M', '', 'gi'
            ),
            '\men vente sur plan \(VEFA\)\M', 'Projet à l''étude', 'gi'
          ),
          'Baguida', 'Gbodjomé', 'gi'
        )
      )
    )
WHERE id = 'cmt0ips4s00044xf04rryvdf8'
  AND "marketingInfo" ? 'description'
  AND lower("marketingInfo"->>'description') ~ '(baguida|littoral|vefa|vente sur plan)';


-- ---------------------------------------------------------------------------
-- 3. units."marketingDescription" — quartier
-- ---------------------------------------------------------------------------
-- 'Studio 25 m² au 3e étage, vue dégagée sur le quartier Baguida. ...'
--   -> 'Studio 25 m² au 3e étage, vue dégagée sur le quartier Gbodjomé. ...'
-- 2 lignes concernées (2 studios du Bloc A).
UPDATE units
SET "marketingDescription" = regexp_replace(
      regexp_replace(
        "marketingDescription",
        '\m(à )?5 min du Littoral\M', '', 'gi'
      ),
      'Baguida', 'Gbodjomé', 'gi'
    )
WHERE lower(coalesce("marketingDescription", '')) ~ '(baguida|littoral)';


-- ---------------------------------------------------------------------------
-- 4. APRÈS — contrôle dans la transaction
-- ---------------------------------------------------------------------------
\echo '=== APRES : projects ==='
SELECT id, name, location, description, "marketingInfo"
FROM projects
WHERE id = 'cmt0ips4s00044xf04rryvdf8';

\echo '=== APRES : units (doit etre vide) ==='
SELECT id, "marketingDescription"
FROM units
WHERE lower(coalesce("marketingDescription", '')) ~ '(baguida|littoral)'
ORDER BY id;

\echo '=== APRES : compteur global de restes (doit etre 0) ==='
SELECT count(*) AS restes
FROM (
  SELECT 1 FROM projects
   WHERE lower(coalesce(name,'')||' '||coalesce(location,'')||' '||coalesce(description,'')||' '||coalesce("marketingInfo"::text,''))
         ~ '(baguida|littoral|vefa|vente sur plan|\mrm ?100)'
  UNION ALL
  SELECT 1 FROM units
   WHERE lower(coalesce("marketingDescription",'')) ~ '(baguida|littoral)'
) t;

-- DRY-RUN : on annule tout. En production réelle, remplacer ROLLBACK par COMMIT
-- UNIQUEMENT après validation explicite.
ROLLBACK;

-- ============================================================================
-- SAUVEGARDE OBLIGATOIRE AVANT TOUTE EXÉCUTION RÉELLE (sur le VPS) :
--   ssh les-terrasses-vps "docker exec -u postgres residence-catalog-prod-db \
--     pg_dump -U postgres -d residence_catalog -Fc" > residence_catalog_AVANT_$(date +%Y%m%d_%H%M).dump
-- Vérifier ensuite : pg_restore --list <fichier> | head
-- ============================================================================
