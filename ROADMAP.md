# ROADMAP — Terrasses de Baguida (Residence Catalog)

> Snapshot au 2026-08-02. Ce document reflete l'etat reel du code (pas les
> intentions). Toute modification de portee doit etre refletée ici au moment
> du commit (R1 : un fichier = un commit = une mise a jour du ROADMAP si la
> portee change).

---

## 1. Vision produit

Plateforme de vente de logements en residence fermée (studios / T2 / T3 / T5 /
locaux commerciaux) à Baguida, Lomé (Togo). Differentiateur : **financement par
lot conditionné aux pré-ventes** — on ne construit que ce qui est déjà financé
par les acheteurs. La PWA web grand public est l'entree principale (catalogue,
réservation 48h, suivi acquéreur), avec des espaces dedies artisans et admin.

## 2. Etat d'avancement par module

### Legend
- **OK** : implémenté et testé
- **IMPL** : implémenté, non testé ou à vérifier
- **STUB** : squelette structurel, logique metier volontairement mince
- **TODO** : non commencé

### Backend (`apps/api`)

| Module           | Etat     | Notes                                                                                                          |
|------------------|----------|----------------------------------------------------------------------------------------------------------------|
| `auth`           | **OK**   | JWT + Strategy + RolesGuard + refresh tokens. Tests spec (bcrypt hash, exp, stratégie) verts (R6). `POST /auth/kyc` (multipart, upload local `uploads/kyc/`, `kycStatus=EN_ATTENTE`). |
| `catalog`        | IMPL     | `getSitePlan` / `searchUnits` / `getProject` / `getProjectBlocks` OK. Pas de test.                            |
| `project`        | IMPL     | CRUD admin + `GET /admin/projects` (`listAllProjects` câblé, inclut brouillons). A tester.                     |
| `reservation`    | **OK**   | Verrou Redis anti-double-vente, expiration BullMQ, `GET /reservations/:id` (garde appartenance 403), admin `adminList`/`adminSetStatus` (CONFIRMEE→unité VENDU + `checkFundingThreshold`). Tests spec + integration + e2e (R6). |
| `payment`        | **OK**   | Clients CinetPay + Stripe réels (fallback démo si clés absentes), webhooks signés sans bypass dev, idempotence `markInstallmentPaid`. + `GET /payments/schedule/:reservationId` (ownership) + `GET /payments/history`. Tests spec + integration + e2e (R6). |
| `construction`   | IMPL     | `publishUpdate` avec garde-fou launchStatus + vérification d'appartenance artisan (ArtisanAssignment). Pas de test. |
| `launch`         | IMPL     | `checkFundingThreshold` — logique metier centrale. Pas de test.                                                |
| `artisan`        | IMPL     | Conforme : vérifie l'ArtisanAssignment (jamais `user.role` seul), `requireArtisanId` → 403 si absent. Côté admin : `listArtisans` / `createArtisan` (mot de passe temporaire non exposé) / `proposeAssignment` / `reviewQuote` (404/400, suppression du cast `as`). |
| `contract`       | STUB     | Pas de generation PDF reelle. Champ `artisanAssignmentId` manque sur `Document` (workaround via `name`).      |
| `notification`   | STUB     | Processor BullMQ en place mais aucun client push/email/SMS branché. Ownership `markRead` sécurisé. `POST /admin/clients/:id/relance` branché dessus. |
| `portal`         | IMPL     | `getDashboard` / `listDocuments` / `getDocumentFile` (téléchargement stream + ownership réservation OU KYC, 403 tiers / 404 absent). Tests unit ownership (R6). |
| `admin`          | **OK**   | Dashboard (`getOccupancy` / `getOverduePayments`) + artisans + réservations + clients/relance. Guards ADMIN partout. Tests unit `adminSetStatus`/`adminList` (R6). |

### Frontend (`apps/web`)

| Route / element   | Etat    | Notes                                                                                            |
|-------------------|---------|--------------------------------------------------------------------------------------------------|
| `/` (home)        | IMPL    | Hero, Mechanism, MasterPlan, CatalogGrid, LeadForm, ReservationModal — mock data pour typo/stock.|
| `/suivi`          | STUB    | Page client 100% mock. Pas de fetch API.                                                         |
| `/artisans`       | STUB    | Page client 100% mock. Pas de fetch API.                                                         |
| `/offline`        | OK      | Ajouté ce jour (fallback SW).                                                                    |
| CatalogGrid       | IMPL    | Donnees typologies en dur. Manque fetch sur `GET /catalog/units`.                               |
| MasterPlan        | IMPL    | Branche sur `fetchSitePlan` + fallback statique.                                                 |
| ReservationModal  | IMPL    | Branche sur `POST /reservations` si JWT present, sinon demo.                                    |
| LeadForm          | IMPL    | Genere un lien WhatsApp, pas d'API.                                                              |
| `lib/api.ts`      | IMPL    | `fetchSitePlan` + `createReservation` branchés. Code mort retiré (R5). Manquent auth + suivi + portal.       |
| **PWA shell**     | **OK**  | Manifest + SW + icônes + offline + update flow (ce jour).                                        |

### Base de données (`packages/database`)

- `schema.prisma` : schema complet, multi-modules (Project, Block, Unit,
  Reservation, PaymentSchedule, Installment, User, Artisan, ArtisanAssignment,
  Document, Notification, Launch, …).
- `seed.ts` : script de seed present.
- **OK** : 2 migrations versionnées (`20260723212901_init`,
  `20260724045739_add_refresh_tokens`) — schema stable en prod.

## 3. Changements PWA appliqués (2026-07-23)

Avant cette session, la PWA avait un manifest minimal et un SW basique sans
strategie differentiee, et **aucune icône PNG n'existait** (refs cassées dans
`manifest.json`). Corrigé :

1. **`public/manifest.json`** — manifest complet : `lang`, `dir`, `id`,
   `display_override`, `categories`, icônes SVG (`any` + `maskable`), 3
   `shortcuts` (catalogue, suivi, reserver).
2. **`public/sw.js`** — stratégies differentiées :
   - navigation HTML : network-first, fallback `/offline`
   - assets `_next/static` + images + CSS/JS : stale-while-revalidate
   - Google Fonts : cache-first 30j
   - API backend : network-first timeout 3s
   - precache shell minimal, gestion versionnee, skipWaiting piloté par message
3. **Icônes SVG** : `favicon.svg`, `icon.svg`, `icon-maskable.svg`,
   `apple-touch-icon.svg`. Aucune dépendance sharp — scalable.
4. **`/offline`** : page statique 100% server-rendered, pre-cachable.
5. **`components/PWARegister.tsx`** : enregistre le SW, detecte
   `beforeinstallprompt` (banniere installer), detecte `updatefound`
   (banniere mettre à jour).
6. **`app/layout.tsx`** : retiré `userScalable: false` (anti-pattern
   accessibilité), branche `PWARegister`, ajoute `apple-touch-icon` + `favicon`
   + `formatDetection` + `locale` OpenGraph.
7. **`#catalogue`** : renomme l'ancre typo → catalogue pour raccord avec les
   shortcuts.

## 4. Roadmap priorisée (alignée au CLAUDE.md § "Ordre de priorité")

### P0 — Obligatoire avant prod

- [x] **DB : migration Prisma initiale versionnée** — OK (`20260723212901_init`
  + `20260724045739_add_refresh_tokens`).
- [x] **`AuthModule` vérifié et testé** : tests login/register/JWT/refresh
  (R6), hash `bcrypt`, expiration token. Verts.
- [x] **`ReservationModule` testé (spec + integration + e2e)** : verrou
  Redis, expiration BullMQ, confirmation, `checkFundingThreshold`.
- [x] **`PaymentModule` testé (spec + integration + e2e)** : webhooks
  CinetPay + Stripe en simulation, idempotence double webhook, recalcul
  launch. Signatures vérifiées sans bypass dev.
- [x] **Variables d'env** : `.env.example` couvre CinetPay + Stripe + Redis +
  JWT + DATABASE_URL + DATABASE_URL_TEST + CORS_ORIGINS. `.env` jamais committé.
- [ ] **Phase 0 (durcissement backend)** : TS strict + DTOs + guards
  d'appartenance + code mort retiré — fait. Reste : revue CI sur les tests
  e2e (dépendent de Postgres/Redis) avant prod.

### P1 — UX produit essentielle

- [ ] **Front `/suivi` : brancher sur API réelle**
  (`GET /portal/reservations/:id` + `GET /payments/schedules/:id`).
- [ ] **Front `/artisans` : brancher sur API réelle**
  (`GET /artisans/me/assignment`, `POST /artisans/quotes`).
- [ ] **Front CatalogGrid : fetch des units réelles**
  (`GET /catalog/units` — le helper supprimé en Phase 0 est à recréer typé).
- [ ] **Front Auth** : pages `/login` + `/register` (le `ReservationModal`
  cherche un JWT qui n'est nulle part créé).
- [ ] **Notification** : brancher un provider (OneSignal / Firebase / Twilio).
  Le processor existe mais n'envoie rien.

### P2 — Fonctionnalites metier non-bloquantes

- [ ] **ContractModule** : vraie generation PDF (puppeteer ou partenaire
  DocuSign) + ajouter `artisanAssignmentId` au schema Prisma.
- [ ] **AdminModule** : dashboard KPIs (ventes, fill rate, launches en cours).
- [ ] **PortalModule** : clarifier le perimetre (acquereur connecte vs
  commercial vs notaire).
- [ ] **Tests e2e Playwright** sur la PWA : parcours reservation + paiement.

### P3 — Performance / PWA avancee

- [ ] **Lighthouse PWA audit** : cibler 100/100/100/100.
- [ ] **Background Sync API** pour soumettre une reservation offline et
  rejouer à la reconnexion.
- [ ] **Periodic Background Sync** pour rafraichir le catalogue.
- [ ] **Push API** pour notifications chantier (depend P2 notif provider).
- [ ] **i18n** : le manifest est en dur en français, prevoir `/_i18n` si
  rollout Togo + diaspora FR/EN.

### P4 — Dette technique observée

- [x] `.html` standalone à la racine du workspace parent
  (`landing-page-lancement.html`, `maquette-plan-de-masse.html`) — **supprimés**
  en Phase 0 ; les composants React equivalents sont la référence.
- [x] `artisan.service.ts` : **conforme** — lookup `ArtisanAssignment` imposé,
  `requireArtisanId()` → 403 si profil absent (R-security).
- [x] `as any` / `@ts-ignore` / code mort — **zéro** dans le code de
  production (Phase 0 : TS strict, DTOs, doublons `auth/roles.*` et méthodes
  mortes supprimés).
- [ ] Tests ciblés manquants sur `construction`, `launch`, `catalog`,
  `project`, `admin` (Phase 0 a couvert auth/payment/reservation).
- [ ] `apps/api/src/common/testing/test-db.helper.ts` contient encore des
  `as any` (usage test uniquement) — à typer proprement.

## 5. Regles rappel (extrait CLAUDE.md)

- **R0** Plan 4 points avant d'ecrire du code
- **R1** Un fichier par commit
- **R2** Pas de `as any` / `@ts-ignore`
- **R3** TypeScript strict
- **R4** Correction à la racine
- **R5** Pas de code mort
- **R6** Tests obligatoires sur Payment/Auth
- **R7** Pas de commit direct sur main, commits en français
- **R8** Hooks pre-commit doivent passer (lint + typecheck)

Le `/admin/*` doit porter `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('ADMIN')`.
Le `/artisans/*` doit verifier l'existence et le statut de l'`ArtisanAssignment`.
`PaymentService.markInstallmentPaid()` est le **seul** point d'entrée pour marquer
une échéance payée. `Block.launchStatus` gouverne tout.

## 6. Comment demarrer (rappel ops)

```bash
# Racine monorepo
pnpm install
pnpm --filter database run db:seed      # alimente projets / blocs / units
pnpm --filter api run start:dev         # NestJS sur :3001
pnpm --filter web run dev               # Next.js sur :3000

# PWA : builder une fois pour que /sw.js et /manifest.json soient servis
pnpm --filter web run build && pnpm --filter web run start
```

## 7. Definition of Done — Phase 0 (durcissement backend)

- [x] PWA installable sur Chrome Android + iOS Safari
- [x] Offline page fonctionnelle
- [x] Update flow SW (banniere "mettre a jour")
- [x] Manifest riche (shortcuts, maskable)
- [x] TS strict sans `any` dans les modifs PWA
- [x] Build Next.js green
- [x] **TS strict `apps/api`** : `tsc --noEmit` = 0 erreur (81 tests verts avant Phase 0.6)
- [x] **`as any` / `@ts-ignore` = 0** dans le code de production (DTOs + types Prisma)
- [x] **Sécurité HTTP** : helmet, CORS restreint + `credentials: true`, ValidationPipe global, Throttler 100 req/min/IP, `@SkipThrottle()` webhooks
- [x] **Guards d'appartenance** : notifications (`markRead`), contrats (propriétaire/admin), chantier (`publishUpdate` vérifie ArtisanAssignment)
- [x] **Webhooks durcis** : signature vérifiée systématiquement (aucun bypass `NODE_ENV`), test dédié « pas de bypass dev »
- [x] **Code mort supprimé** : doublons `auth/roles.*`, `admin.listReservations`/`updateReservationStatus`, `fetchBlockUnits`/`initiatePayment` web, `.html`/`.ts` orphelins racine parent
- [x] Docs alignées (ROADMAP + CLAUDE.md) ; `CORS_ORIGINS` ajouté à `.env.example`

## 8. Phase 2 — Complétude OpenAPI (2026-08-03)

Objectif : aligner le code sur `openapi-residence-catalog.yaml` — 14 endpoints
manquants implémentés (dont des méthodes mortes câblées), avec tests R6.

- [x] **Lecture publique** : `GET /catalog/projects/:id/blocks` ;
  `GET /reservations/:id` (404/403 appartenance) ;
  `GET /payments/schedule/:reservationId` (ownership) + `GET /payments/history`.
- [x] **Fichiers (KYC + download)** : `POST /auth/kyc` (multipart `documentType` +
  `file`, PNG/JPG/PDF ≤ 5 Mo, nom fichier généré UUID, `kycStatus=EN_ATTENTE`) ;
  `GET /portal/documents/:id/download` (stream + ownership réservation OU KYC).
  `uploads/` ajouté au `.gitignore`. `@types/multer` installé.
- [x] **Admin** : `GET /admin/projects` (`listAllProjects` câblé) ;
  `GET|POST /admin/artisans` ; `POST /admin/artisans/assignments`
  (`proposeAssignment` câblé) ; `PATCH /admin/artisans/quotes/:id/review`
  (`reviewQuote` câblé, cast `as` supprimé, gardes 404/400) ;
  `GET /admin/reservations` + `PATCH /admin/reservations/:id/status`
  (CONFIRMEE → unité VENDU + `checkFundingThreshold`, ANNULEE → unité DISPONIBLE) ;
  `POST /admin/clients/:id/relance` (notification).
  Tout sous `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('ADMIN')`.
- [x] **Infra tests** : `RedisModule.onApplicationShutdown` ferme la connexion
  ioredis (le worker jest restait bloqué après les e2e) ; `maxWorkers: 1` dans
  la config jest (suites e2e/integration partageant `DATABASE_URL_TEST`, TRUNCATE
  croisés en parallèle).
- [x] **Vérifs** : `tsc --noEmit` = 0 erreur ; suite jest verte (10 suites,
  104 tests : + KYC, + getSchedule/getHistory, + adminSetStatus/adminList,
  + getDocumentFile) ; `nest build` OK.
- [ ] **À noter (hors Phase 2)** : `createArtisan` génère un mot de passe
  temporaire non exposé — un flux de réinitialisation de mot de passe est requis
  avant que le compte artisan soit utilisable (à prévoir en Phase 3).

## 9. Phase 3 — Prod readiness (2026-08-03)

Objectif : rendre la plateforme déployable sur un VPS (Docker) et débloquer
l'accès des comptes créés sans mot de passe (artisans).

- [x] **Conteneurisation** : `apps/api/Dockerfile` (multi-stage pnpm :
  deps → build avec `prisma generate` → runtime `pnpm deploy --prod`,
  user non-root, openssl/libc6-compat pour Prisma sur Alpine ; cible
  `migrate` séparée) ; `apps/web/Dockerfile` (Next.js `output: 'standalone'`,
  `ARG NEXT_PUBLIC_API_URL` inlinée au build) ; `.dockerignore` racine
  (`**/node_modules` — les `node_modules` imbriqués cassaient les symlinks
  pnpm dans l'image).
- [x] **Orchestration** : `docker-compose.prod.yml` (db + redis internes,
  job one-shot `migrate` (`prisma migrate deploy`) avant l'API, uploads
  persistants dans un volume, `init: true`, healthchecks) ; compose de dev
  inchangé. `multer` déclaré en dépendance API (il n'était résolu que par
  hoisting en dev — absent du bundle de prod sinon). Le client Prisma
  généré est recopié dans le dossier `pnpm deploy` (le store pnpm global
  ne l'embarque pas).
- [x] **Reset de mot de passe (R6)** : modèle `PasswordResetToken` (hash
  SHA-256, 1h, usage unique) + migration ; `POST /auth/forgot-password`
  (anti-énumération, token retourné en mode démo uniquement) ;
  `POST /auth/reset-password` (consomme le token, **révoque tous les
  refresh tokens** du user) ; `POST /admin/artisans` retourne désormais
  `{ artisan, resetToken }` — l'admin transmet le token à l'artisan.
  Spec OpenAPI alignée (`/auth/forgot-password`, `/auth/reset-password`,
  réponse `POST /admin/artisans`).
- [x] **Tests R6** : tests unitaires Auth/Email (anti-énumération, expiration,
  usage unique, révocation des sessions, remise SMTP) + tests e2e (flow
  complet forgot → reset → sessions mortes). Suite complète : 11 suites,
  120/120 tests verts.
- [x] **Email de reset** : `EmailService` SMTP générique dans
  `common/email` (Resend, Brevo, Mailgun ou relais SMTP), lien construit via
  `PUBLIC_WEB_URL`, mode démo hors production si SMTP absent et aucun token
  exposé/loggé en production. `AuthModule` déclare explicitement sa
  dépendance à `EmailModule`.
- [x] **Vérifs** : `tsc --noEmit` = 0 ; builds réels des 3 images OK ;
  stack prod montée localement : migrations appliquées, `/v1/catalog/projects`
  200, register/login OK avec cookies `Secure; HttpOnly`, web 200.
- [ ] **Reste (hors Phase 3)** : reverse proxy TLS sur le VPS (les cookies
  `Secure` exigent HTTPS) ; provider SMS éventuel pour la remise des tokens
  de reset. L'envoi email SMTP est préparé ; il reste à renseigner les
  identifiants SMTP et le domaine dans l'environnement de production.

## 10. Phase 4 — Parcours web de récupération (2026-08-03)

- [x] **Demande de reset** : page `/forgot-password` reliée à
  `POST /auth/forgot-password`, avec réponse générique anti-énumération.
- [x] **Nouveau mot de passe** : page `/reset-password` reliée à
  `POST /auth/reset-password`, token lu depuis le lien email, validation
  frontend du mot de passe et confirmation de succès.
- [x] **Navigation** : lien « Mot de passe oublié ? » ajouté à `/login`.
- [x] **Vérifications** : routes Next générées en build et typecheck web
  sans erreur.
- [ ] **Reste** : reverse proxy TLS VPS et éventuel provider SMS.

## 11. Phase 4 — Reverse proxy TLS (2026-08-03)

- [x] **Caddy** : `Caddyfile` route `APP_DOMAIN` vers Next et `API_DOMAIN`
  vers Nest, avec certificats Let's Encrypt automatiques, compression et
  HSTS côté API.
- [x] **Isolation réseau** : seuls les ports `80/443` sont publiés par
  `docker-compose.prod.yml`; les services `api` et `web` restent internes.
- [x] **Configuration** : `APP_DOMAIN`, `API_DOMAIN` et
  `NEXT_PUBLIC_API_URL` documentés dans `.env.example`.
- [ ] **Déploiement réel** : remplacer les domaines d'exemple, créer les
  enregistrements DNS A/AAAA vers le VPS et ouvrir `80/443`.
