# BACKLOG — Résidence Catalog (web)

Chantiers différés, décidés en revue. Chaque entrée correspond aux `TODO` /
commentaires "chantier N" présents dans le code. À traiter dans un cycle dédié,
pas en passant.

## 1. Chantier 4 — Overview 3D piloté par `project.views` (données réelles)
- `ComplexOverviewViewer.tsx` est encore alimenté par le mock localStorage
  (`lib/catalogData.ts`) : plan de masse SVG hardcodé + hotspots sur ids mock
  (`unit-studio`, `unit-t2`…).
- Cible : alimenter le viewer par `project.views` (hotspots câblés sur les vrais
  `blockId`, seed `apps/api`), puis **supprimer** `lib/catalogData.ts`,
  `lib/catalog/overview-bridge.ts` (pont temporaire) et son test.
- Référence : commentaire d'en-tête de `lib/catalog/overview-bridge.ts`.
- Garde-fou à conserver : un hotspot sans bloc réel = inerte (jamais de fausse
  fiche), comportement déjà testé dans `overview-bridge.test.ts`.

## 2. Parcours d'accueil (`/`) typologie-based → unité réelle
- `components/CatalogGrid.tsx` + `MasterPlanInteractive.tsx` sont mock/typologie
  driven. `ReservationModal` y est appelée avec `unitId={null}` et renvoie
  vers `/catalogue` (comportement documenté dans `app/page.tsx`).
- Cible : sélectionner une unité réelle (cuid) depuis la home, retirer le renvoi
  vers le catalogue.

## 3. Boutons "Plaquette PDF" et "Option Prioritaire 48h" — endpoints réels
- Dans `Apartment3DModal.tsx` : `handleDownloadPdf` est un `alert()` stub, le
  modal "Option 48h" ne persiste rien.
- Cible : endpoint plaquette/notice PDF (les contrats existent via
  `ContractPdfService` côté API) + endpoint de verrou option, ou retirer les
  interactions fantômes si hors périmètre produit.

## 4. ESLint sur `apps/web`
- `next lint` n'est pas configuré (prompt d'init non exécuté). Le build embarque
  son propre lint typecheck, mais `pnpm --filter web lint` n'est pas actionnable.
- Cible : config ESLint + `lint` vert, brancher au hook pre-commit (R8).

## 5. Commit d'infra en attente — `CLAUDE.md` racine
- 8 lignes ajoutées non commitées (hors chantier catalogue). À valider par le
  dev avant d'être commité ou écarté.

## 6. Mise à jour pnpm (actuellement 9.0.0, avril 2024)
- Écartée volontairement du cycle catalogue actif : ne pas introduire de
  variable de plus en plein chantier. À faire dans un cycle dédié.
- Justification : plusieurs bugs Windows du store virtuel (extractions
  `.pnpm` incomplètes) corrigés dans les versions 9.x récentes / 10.x.
- Garde-fou en attendant : `scripts/verify-install.cjs` branché sur `dev`
  (détecte un package critique vide avant de lancer les serveurs).

## 7. Typage de l'éditeur admin catalogue
- `apps/web/app/admin/catalogue/page.tsx` contient encore deux paramètres
  `any` dans `handleUpdateUnitField` et `handleUpdateViewField`.
- Hors SC3 : à corriger dans un cycle dédié avec des types de champs explicites,
  sans cast de contournement ni régression de l'éditeur.

## 8. CI — ne construit jamais l'image Docker
- La CI (`ci.yml`) n'exécute que `pnpm install` + `tsc --noEmit` + Jest : le
  build Docker (Dockerfiles `apps/api` et `apps/web`) n'est jamais validé avant
  le merge.
- Impact constaté en réel : l'incompatibilité Dockerfile/pnpm (bump pnpm
  9→11.1.1, `ERR_PNPM_DEPLOY_NONINJECTED_WORKSPACE`) n'a été détectée qu'au
  déploiement sur le VPS, alors qu'elle casse tout build de production.
- Cible : ajouter un job/stage de build Docker (api + web, `--build` uniquement,
  pas de `push`) à la CI pour détecter ce type de casse avant le merge.
  Même famille de faille de process que la base de test non resynchronisée
  automatiquement : se corriger une fois qu'on la voit, pas seulement ce cas.
