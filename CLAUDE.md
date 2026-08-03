# CLAUDE.md — Résidence Catalog

Ce fichier gouverne le comportement de l'agent d'implémentation (GLM) sur ce
repo. Il est complémentaire au CLAUDE.md générique déjà utilisé sur AGIR —
les règles R0-R8 s'appliquent ici à l'identique, avec les précisions
spécifiques à ce projet ci-dessous.

## Contexte projet

Plateforme de vente de logements en résidence fermée (studios/T2/T3),
catalogue digital + réservation + paiement échelonné + suivi chantier +
gestion artisans + financement par lot conditionné aux pré-ventes.

Stack : NestJS (API) + Next.js (web, PWA) + Prisma/PostgreSQL + Redis +
BullMQ, en Turborepo. Voir `openapi-residence-catalog.yaml` à la racine
pour le contrat d'API de référence — toute implémentation d'endpoint doit
s'y conformer strictement (path, méthode, schéma de réponse).

## Règles R0-R8 (rappel, identiques à AGIR)

- R0 — Plan obligatoire avant toute action : décrire le fichier à créer/
  modifier et pourquoi, avant d'écrire du code.
- R1 — Un fichier par commit. Pas de commit fourre-tout.
- R2 — Jamais de `as any` ni `@ts-ignore`. Si le typage Prisma généré ne
  correspond pas, corriger le schema ou le type, pas contourner.
- R3 — TypeScript strict mode partout, aucune exception.
- R4 — Correction à la racine du problème, jamais de workaround temporaire
  laissé en l'état.
- R5 — Pas de code mort, pas de fonction non appelée laissée "au cas où".
- R6 — Tout endpoint qui touche à l'argent (PaymentModule) ou à la
  sécurité (AuthModule, RolesGuard) doit avoir un test associé avant merge.
- R7 — Commits en français, messages descriptifs (pas de "fix", "update").
- R8 — Hooks pre-commit doivent passer (lint + typecheck) avant tout commit.

## Règles spécifiques à ce projet

### Sécurité des rôles — non négociable
Toute route sous `/admin/*` DOIT porter `@UseGuards(JwtAuthGuard, RolesGuard)`
et `@Roles('ADMIN')`. Toute route sous `/artisans/*` (hors `/admin/artisans/*`)
doit vérifier que le user a un profil `Artisan` lié — ne jamais faire
confiance à `user.role === 'ARTISAN'` seul, toujours vérifier l'existence
et le statut de l'`ArtisanAssignment` avant d'exposer une donnée de chantier.

`user.artisanId` est résolu dans `JwtStrategy.validate()` (lookup Prisma
à chaque requête, pas stocké dans le JWT signé) pour rester à jour si le
profil Artisan change sans réémission de token. Si vous ajoutez un champ
dérivé similaire, suivez ce même principe plutôt que de l'ajouter au
payload JWT.

### Le cycle Launch (financement par lot) est la logique métier centrale
`Block.launchStatus` gouverne tout : `ConstructionModule.publishUpdate()`
refuse déjà toute écriture tant que le lot n'est pas `EN_CONSTRUCTION`
(voir garde-fou déjà en place). Ne jamais contourner ce garde-fou, même
pour un test ou un seed de démo — créer plutôt un lot de test déjà au bon
statut via un script de seed dédié.

`ReservationService.confirmReservation()` appelle automatiquement
`LaunchService.checkFundingThreshold()`. Si vous ajoutez un autre chemin
de confirmation de vente (ex: vente manuelle par un commercial hors app),
il DOIT également déclencher ce check — sinon le seuil de financement ne
sera jamais recalculé pour ces ventes. C'est le cas de
`ReservationService.adminSetStatus(reservationId, 'confirmee')` (Phase 2).

### Paiements — idempotence obligatoire
`PaymentService.markInstallmentPaid()` est le point d'entrée unique pour
marquer une échéance payée, volontairement idempotent (webhooks providers
souvent renvoyés en double). Toute nouvelle logique de paiement doit
passer par cette méthode, jamais écrire directement `installment.status`
ailleurs dans le code.

### Upload de fichiers (KYC)
`POST /auth/kyc` accepte un multipart `documentType` + `file` (PNG/JPG/PDF,
≤ 5 Mo) via multer (`apps/api/src/modules/auth/auth.controller.ts`). Le nom
de fichier est généré côté serveur (UUID + extension dérivée du MIME — jamais
le nom client, source classique de path traversal) et stocké sous `uploads/`
(dans `.gitignore`, jamais commité). Les chemins sont résolus par
`common/files/uploads.util.ts` qui rejette tout traversal (`..`). Le
téléchargement `GET /portal/documents/:id/download` vérifie l'appartenance
(réservation liée OU propriétaire KYC) avant de streamer le fichier.

### Modules encore à l'état de squelette (voir avant d'étoffer)
`ContractModule` et la partie dispatch de `NotificationModule` restent
volontairement minces :
- `ContractService` : pas de génération PDF réelle ni signature électronique.
  Le champ `artisanAssignmentId` dédié sur `Document` est maintenant en place
  et utilisé pour les contrats artisans.
- `NotificationDispatchProcessor` : pas de client push/SMS branché. L'envoi
  email transactionnel de reset passe par `common/email/EmailService` (SMTP)
  et ne dépend pas du worker BullMQ.
- `PaymentModule` (réalisé en Phase 0) : clients `CinetPayClient` /
  `StripeClient` réels — un vrai `fetch` est tenté si les clés sont
  configurées, sinon fallback **mode démo** (clés factices, URL d'aperçu),
  jamais un stub qui lève. Les signatures de webhooks sont toujours
  vérifiées, quel que soit `NODE_ENV` — en démo les clés factices signent.
- `auth`, `reservation`, `payment`, `admin`, `portal`, `catalog`, `artisan` :
  implémentés pour la portée OpenAPI (Phase 2) et testés (R6) sur les chemins
  argent/sécurité. Ne pas régresser ces garanties.

Avant de coder une feature qui dépend d'un de ces modules, vérifier son
état réel dans le code plutôt que de supposer qu'il est complet.

### Durcissement Phase 0 (fait, à maintenir)
- TypeScript **strict** sur `apps/api` : `tsc --noEmit` doit rester à 0
  erreur. Interdiction de désactiver (`as any`, `@ts-ignore`).
- Tous les handlers HTTP passent par des DTOs `class-validator` (ValidationPipe
  global `whitelist` + `forbidNonWhitelisted`).
- Les lectures/écritures liées au user doivent être scoped par appartenance
  (`userId` passé depuis le token, jamais fourni par le client).
- Signatures webhook CinetPay/Stripe : toujours vérifiées, aucun bypass.

### Variables d'environnement
Voir `.env.example` à la racine. Ne jamais commit de `.env` réel (déjà
dans `.gitignore`). Toute nouvelle variable ajoutée doit être documentée
dans `.env.example` dans le même commit.

## Ordre de priorité pour la suite du MVP

1. ~~Migration Prisma initiale + seed de démo~~ — **fait** (2 migrations versionnées).
2. ~~Clients CinetPay/Stripe réels~~ — **fait** (vrais fetch, fallback démo, webhooks signés).
3. Frontend `apps/web` : catalogue public + flux réservation (priorité sur admin/artisan)
4. ~~Tests ReservationModule / PaymentModule (R6)~~ — **fait** (spec + integration + e2e verts).
5. ~~Phase 1 — parcours acheteur connecté~~ — **fait** (cookies httpOnly JWT,
   pages `/login` `/register`, `/suivi` branché sur l'API).
6. ~~Phase 2 — complétude OpenAPI~~ — **fait** (14 endpoints implémentés, méthodes
   mortes câblées, 104 tests verts, docs alignées).
7. ~~Phase 3 — prod readiness~~ — **fait** (Dockerfiles api+web,
   `docker-compose.prod.yml`, flux reset de mot de passe pour les comptes
   créés sans mot de passe : artisans via `POST /admin/artisans` →
   `{ artisan, resetToken }`, self-service via `POST /auth/forgot-password` +
   `POST /auth/reset-password`). Email SMTP générique préparé via
   `common/email/EmailModule`; restent le reverse proxy TLS sur le VPS
   (cookies `Secure` exigent HTTPS), les identifiants SMTP/domaine de prod et
   un éventuel provider SMS (Phase 4). Le reverse proxy Caddy est préparé
   dans `Caddyfile` et le compose prod ne publie plus directement API/web.
8. ~~Phase 4 — parcours web de récupération~~ — **fait pour le flux email**
   (`/forgot-password`, `/reset-password`, appels API typés, validation du
   nouveau mot de passe). Restent le renseignement des domaines/DNS du VPS
   et un éventuel provider SMS.
9. ~~Phase 4 — reverse proxy TLS~~ — **préparé** (`Caddyfile`, routage
   `APP_DOMAIN`/`API_DOMAIN`, certificats automatiques, ports web/API
   internes). Reste le renseignement des domaines réels et leur DNS.
10. **Tests métier ciblés** — `ConstructionService` et `LaunchService` sont
    maintenant couverts (garde d’affectation, statut de construction,
    seuil de pré-vente et transitions de financement), ainsi que `catalog`,
    `project` et `admin`. `as any`/`@ts-ignore` sont absents de `apps/api/src`.
