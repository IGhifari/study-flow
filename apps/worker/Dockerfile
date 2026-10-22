# Monorepo build for StudyFlow Worker
# Build command: docker build -f apps/worker/Dockerfile -t studyflow-worker:latest .

FROM node:22.23.4-alpine AS base
WORKDIR /app

# Stage 1: Install dependencies and build
FROM base AS builder

COPY package.json package-lock.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY apps/worker/package.json ./apps/worker/

RUN npm ci

COPY packages/config/ ./packages/config/
COPY packages/shared/ ./packages/shared/
COPY packages/database/ ./packages/database/
COPY apps/worker/ ./apps/worker/

# Build shared package, generate prisma client, build database package, and compile worker
RUN npm run build --workspace=@studyflow/shared
RUN npm run generate --workspace=@studyflow/database
RUN npm run build --workspace=@studyflow/database
RUN npm run build --workspace=@studyflow/worker

# Stage 2: Production runner
FROM base AS runner
ENV NODE_ENV=production

USER node

COPY --chown=node:node --from=builder /app/package.json /app/package-lock.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/packages/shared ./packages/shared
COPY --chown=node:node --from=builder /app/packages/database ./packages/database
COPY --chown=node:node --from=builder /app/apps/worker/package.json ./apps/worker/
COPY --chown=node:node --from=builder /app/apps/worker/dist ./apps/worker/dist

CMD ["node", "apps/worker/dist/worker.js"]
