# ==========================================================
# Résidence Catalog — API (NestJS)
# Build de production dans un monorepo pnpm (workspace
# packages/database + apps/api).
#
# Cibles :
#   - default / runner : image minimale qui exécute dist/main.js
#   - migrate         : image avec le CLI Prisma + les migrations,
#                       utilisée par le job one-shot du docker-compose.prod
# ==========================================================

# --- Base : Node 22 LTS + pnpm via corepack ---
FROM node:22-alpine AS base
# openssl/libc6-compat : requis par le moteur Prisma sur Alpine (musl),
# sinon "failed to detect the libssl/openssl version" au runtime et à
# `prisma migrate deploy`.
RUN corepack enable && apk add --no-cache openssl libc6-compat
WORKDIR /app

# --- Dépendances : frozen lockfile (même mode que la CI) ---
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/database/package.json packages/database/
RUN pnpm install --frozen-lockfile

# --- Build : génération du client Prisma + compilation NestJS ---
FROM deps AS build
COPY . .
RUN pnpm --filter @residence-catalog/database exec prisma generate
RUN pnpm --filter @residence-catalog/api build
RUN pnpm --filter @residence-catalog/api exec tsc --noEmit

# Assemblage du runtime de production : `pnpm deploy` copie les deps de
# prod dans /app/deploy MAIS depuis le store global pnpm, qui ne contient
# pas le client Prisma généré (il vit dans le vstore du workspace). On
# recopie donc explicitement le client généré dans le dossier déployé.
RUN pnpm --filter @residence-catalog/api deploy --prod /app/deploy \
  && SRC=$(ls -d /app/node_modules/.pnpm/@prisma+client@*/node_modules/.prisma) \
  && DST=$(ls -d /app/deploy/node_modules/.pnpm/@prisma+client@*/node_modules/) \
  && cp -r "$SRC" "$DST" \
  && cp -r /app/apps/api/dist /app/deploy/dist \
  && chown -R node:node /app/deploy

# --- Migrations : CLI Prisma + schema + migrations versionnées ---
FROM build AS migrate
CMD ["pnpm", "--filter", "@residence-catalog/database", "exec", "prisma", "migrate", "deploy"]

# --- Runtime : dossier de prod autonome, user non-root ---
FROM node:22-alpine AS runner
RUN corepack enable && apk add --no-cache openssl libc6-compat
ENV NODE_ENV=production
ENV PORT=3001

WORKDIR /app/deploy
COPY --from=build /app/deploy ./
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]
