# AGENTS.md Global - Moussa Keita

## Regles absolues (tous projets)
- Correction = root-cause uniquement. Workarounds INTERDITS.
- `as any`, `@ts-ignore`, `@ts-nocheck`, `eslint-disable` INTERDITS.
- Un fichier a la fois, validation entre chaque modification.
- `tsc --noEmit` = 0 erreur avant tout commit.
- Aucun commit sans validation explicite du developpeur.
- Presenter un plan en 4 points AVANT toute action (R0).
- Jamais committer directement sur main (R7).
- Jamais committer un fichier .env (R5).
- Comptes tiers de Moussa (Stripe, Backblaze B2, tout service externe) : toute création/modification/suppression de ressource est ANNONCEE a Moussa AVANT execution, avec son feu vert — jamais en autonomie, meme si l'intention est bonne et le resultat correct. Lecture/verification seule autorisee sans annonce (R8).

## Acces VPS production - App Les Terrasses
- VPS prod (Contabo partage) : `ssh les-terrasses-vps` — alias defini dans `~/.ssh/config` (HostName 169.58.53.64, User deploy, cle `~/.ssh/glm_agent_deploy`, IdentitiesOnly). Aucun mot de passe, uniquement la cle.
- Repo sur le VPS : `~/app-les-terrasses` (branche `main`).
- Deploiement : `git pull origin main` puis `docker compose -f docker-compose.prod.yml up -d --build` (les migrations Prisma s'appliquent via le job one-shot `migrate` avant le demarrage de l'API).
- REGLE : avant de conclure « pas d'acces / pas deployable », TOUJOURS tester : `ssh les-terrasses-vps 'true'` (ou `ssh -v les-terrasses-vps 'hostname'`). Ne jamais conclure a un blocage sans avoir teste cet alias.

## Projets actifs
- CertifAuto : certification automobile, Next.js + NestJS + Supabase + Railway
- AfricoShip : transport France-Afrique, Next.js 14 + NestJS + Prisma + Flutterwave

## Workflow multi-model
- GLM 4.7 : planification et developpement
- Codex : review obligatoire pour code financier (R6)

## Initialisation automatique de contexte

**En début de session, pour chaque projet** :

1. Vérifier si `DAILY_CONTEXT.md` existe dans le projet
2. Si le fichier existe et est âgé de +4h → régénérer automatiquement
   - Exécuter : `node scripts/update-context.js`
3. Si le fichier n'existe pas → initialiser automatiquement
   - Exécuter : `node ~/.Codex/scripts/init-project-context.js`

**Déclencheurs automatiques de mise à jour** :
- **Post-commit** : Hook Git met à jour après chaque commit
- **Tâche planifiée** : Windows Task Scheduler toutes les 30 minutes
- **Début session** : Si fichier vieux de +4h

# graphify
- **graphify** (`~/.Codex/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
When the user types `/graphify`, invoke the Skill tool with `skill: "graphify"` before doing anything else.

@RTK.md

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
