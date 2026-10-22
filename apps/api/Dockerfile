# Monorepo build for StudyFlow API
# Build command: docker build -f apps/api/Dockerfile -t studyflow-api:latest .

FROM node:22.23.4-alpine AS base
WORKDIR /app

# Stage 1: Install dependencies and build
FROM base AS builder

COPY package.json package-lock.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY apps/api/package.json ./apps/api/

RUN npm ci

COPY packages/config/ ./packages/config/
COPY packages/shared/ ./packages/shared/
COPY packages/database/ ./packages/database/
COPY apps/api/ ./apps/api/

# Build shared package, generate prisma client, build database package, and compile API
RUN npm run build --workspace=@studyflow/shared
RUN npm run generate --workspace=@studyflow/database
RUN npm run build --workspace=@studyflow/database
RUN npm run build --workspace=@studyflow/api

# Stage 2: Production runner
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=4000

USER node

COPY --chown=node:node --from=builder /app/package.json /app/package-lock.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/packages/shared ./packages/shared
COPY --chown=node:node --from=builder /app/packages/database ./packages/database
COPY --chown=node:node --from=builder /app/apps/api/package.json ./apps/api/
COPY --chown=node:node --from=builder /app/apps/api/dist ./apps/api/dist

EXPOSE 4000

CMD ["node", "apps/api/dist/server.js"]
