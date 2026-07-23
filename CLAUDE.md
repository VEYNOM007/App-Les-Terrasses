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
sera jamais recalculé pour ces ventes.

### Paiements — idempotence obligatoire
`PaymentService.markInstallmentPaid()` est le point d'entrée unique pour
marquer une échéance payée, volontairement idempotent (webhooks providers
souvent renvoyés en double). Toute nouvelle logique de paiement doit
passer par cette méthode, jamais écrire directement `installment.status`
ailleurs dans le code.

### Modules encore à l'état de squelette (voir avant d'étoffer)
`AuthModule`, `CatalogModule`, `ProjectModule`, `PortalModule`,
`NotificationModule`, `AdminModule`, `ContractModule` ont une structure
correcte mais des implémentations volontairement minces :
- `ContractService` : pas de génération PDF réelle, pas de champ
  `artisanAssignmentId` dédié sur `Document` (actuellement stocké dans
  `name`, à corriger proprement en ajoutant le champ au schema).
- `NotificationDispatchProcessor` : pas de client push/email/SMS branché.
- `PaymentService.initiatePayment()` : stub qui lève une erreur, les
  clients `CinetPayClient`/`StripeClient` réels restent à écrire.

Avant de coder une feature qui dépend d'un de ces modules, vérifier son
état réel dans le code plutôt que de supposer qu'il est complet.

### Variables d'environnement
Voir `.env.example` à la racine. Ne jamais commit de `.env` réel (déjà
dans `.gitignore`). Toute nouvelle variable ajoutée doit être documentée
dans `.env.example` dans le même commit.

## Ordre de priorité suggéré pour la suite du MVP

1. Migration Prisma initiale + seed de données de démo (1 projet, 2 blocs à statuts différents, quelques unités)
2. Clients CinetPay/Stripe réels dans PaymentModule
3. Frontend `apps/web` : catalogue public + flux réservation (priorité sur admin/artisan)
4. Tests sur ReservationModule et PaymentModule (R6)
