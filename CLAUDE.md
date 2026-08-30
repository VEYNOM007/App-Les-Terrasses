# CLAUDE.md — Résidence Catalog

Ce fichier gouverne le comportement de l'agent d'implémentation (GLM) sur ce
repo. Il est complémentaire au CLAUDE.md générique déjà utilisé sur AGIR —
les règles R0-R8 s'appliquent ici à l'identique, avec les précisions
spécifiques à ce projet ci-dessous.

## Repo Git

Le repo Git réel se trouve dans `residence-catalog/`, pas à la racine du
dossier parent `App-Les Terrasse`. Toute commande git (status, commit, log...)
doit être lancée depuis `residence-catalog/`. Les fichiers à la racine du
dossier parent (Caddyfile, checklists, openapi de référence) sont volontairement
hors versioning — ne pas essayer de les commit.

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

### Accès VPS production
VPS prod (Contabo partagé) : `ssh les-terrasses-vps` — alias défini dans `~/.ssh/config`
(HostName 169.58.53.64, User deploy, clé `~/.ssh/glm_agent_deploy`, `IdentitiesOnly`). Aucun mot de
passe, uniquement la clé. Repo distant : `~/app-les-terrasses` (branche `main`). Déploiement :
`git pull origin main` puis `docker compose -f docker-compose.prod.yml up -d --build` (les migrations
Prisma s'appliquent via le job one-shot `migrate` avant le démarrage de l'API).
**Règle : ne jamais conclure « pas d'accès » sans avoir d'abord testé `ssh les-terrasses-vps 'true'`.**

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
La partie dispatch de `NotificationModule` reste volontairement mince :
- `ContractService` : **génération PDF réelle** (`ContractPdfService.generate`,
  `pdf-lib`, copie persisée sur disque) et **signature électronique double**
  en place — `POST /contracts/:documentId/sign` (canvas PNG côté web,
  `ContractSignature` PROPRIETAIRE puis ADMIN, idempotent 409, ownership
  réservation OU ArtisanAssignment, PDF contresigné via
  `ContractPdfService.sign` exposé par `signedFileUrl`).
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

### Sécurité chaîne d'approvisionnement (pnpm exclusif, renforcée)
- pnpm est le seul gestionnaire de paquets autorisé (pas de npm/yarn, pas de
  mélange). `packageManager` dans `package.json` = `pnpm@11.1.1` (pnpm >= 10
  requis : les protections `minimumReleaseAge` et `allowBuilds` n'existent
  pas avant). Si corepack réinstalle une 9.x, c'est une régression à corriger.
- `minimumReleaseAge: 10080` (7 jours) dans `pnpm-workspace.yaml` : toute
  version publiée depuis moins de 7 jours est bloquée à l'installation.
  Ne jamais baisser ce délai ni ajouter de paquet à `minimumReleaseAgeExclude`
  pour installer une dépendance "urgente" — si le paquet est légitime, il
  suffit d'attendre qu'il vieillisse.
- `allowBuilds` : whitelist stricte des seuls paquets autorisés à exécuter
  leurs scripts de build (`bcrypt`, `esbuild`, `msgpackr-extract`, `prisma`,
  `@prisma/client`, `@prisma/engines`) ; `@nestjs/core` y figure explicitement
  à `false` (postinstall OpenCollective, télémétrie inutile). Toute nouvelle
  dépendance avec un script de build (postinstall/install/preinstall) DOIT
  être examinée manuellement puis ajoutée à cette whitelist dans le même
  commit que la dépendance. Jamais `dangerouslyAllowAllBuilds`.
- Install frais : le postinstall de `@prisma/client` ne trouve pas le schéma
  (chemin custom `packages/database/prisma/schema.prisma`), donc après
  `pnpm install` lancer obligatoirement `pnpm --filter @residence-catalog/database generate`
  (régénère le client dans `.pnpm/.../node_modules/@prisma/client`) avant
  tout `tsc --noEmit` sur `apps/api`.
- Avant d'ajouter une dépendance : vérifier son âge (le blocage
  `minimumReleaseAge` est volontaire), l'existence de scripts de build
  (`pnpm view <pkg> scripts`), et que le commit qui l'introduit passe
  `pnpm install` (strict) + lint + typecheck (R8).

### Base de test — synchronisation automatique (ne PAS créer/migrer à la main)
`residence_catalog_test` est créée et migrée automatiquement à chaque
invocation de Jest par `apps/api/src/jest.global-setup.ts` (globalSetup) :
création idempotente via `prisma db execute` + `prisma migrate deploy`.
Ni `docker compose`, ni la CI, ni un script manuel ne doivent provisionner
cette base — c'est la seule source de vérité. En local, il suffit d'avoir
les conteneurs `docker compose up -d` (Postgres + Redis) puis `pnpm test`.

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
   un éventuel provider SMS (Phase 4). Le reverse proxy TLS est assuré par
   l'Nginx hôte (server blocks de référence dans
   `infra/nginx/immo-les-terrasse.conf`) ; le compose prod ne publie
   API/web que sur `127.0.0.1` (jamais directement).
8. ~~Phase 4 — parcours web de récupération~~ — **fait pour le flux email**
   (`/forgot-password`, `/reset-password`, appels API typés, validation du
   nouveau mot de passe). Restent le renseignement des domaines/DNS du VPS
   et un éventuel provider SMS.
9. ~~Phase 4 — reverse proxy TLS~~ — **préparé** (server blocks Nginx hôte
   dans `infra/nginx/immo-les-terrasse.conf`, routage `WEB_DOMAIN`/
   `API_DOMAIN`, ports API/web publiés sur `127.0.0.1`). Restent les
   certificats Let's Encrypt via `certbot --nginx` une fois le DNS en place.
10. **Tests métier ciblés** — `ConstructionService` et `LaunchService` sont
    maintenant couverts (garde d’affectation, statut de construction,
    seuil de pré-vente et transitions de financement), ainsi que `catalog`,
    `project` et `admin`. `as any`/`@ts-ignore` sont absents de `apps/api/src`.
