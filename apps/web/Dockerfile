# Monorepo build for StudyFlow Web Frontend
# Build command: docker build -f apps/web/Dockerfile -t studyflow-web:latest .

FROM node:22.23.4-alpine AS base
WORKDIR /app

# Stage 1: Install dependencies and build
FROM base AS builder

COPY package.json package-lock.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

RUN npm ci

COPY packages/config/ ./packages/config/
COPY packages/shared/ ./packages/shared/
COPY apps/web/ ./apps/web/

# Build shared package then web app
RUN npm run build --workspace=@studyflow/shared
RUN npm run build --workspace=@studyflow/web

# Stage 2: Production runner
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000

USER node

COPY --chown=node:node --from=builder /app/package.json /app/package-lock.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/packages/shared ./packages/shared
COPY --chown=node:node --from=builder /app/apps/web/package.json ./apps/web/
COPY --chown=node:node --from=builder /app/apps/web/.next ./apps/web/.next
COPY --chown=node:node --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

CMD ["npx", "next", "start", "apps/web", "-p", "3000"]
