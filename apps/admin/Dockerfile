# Monorepo build for StudyFlow Admin Frontend
# Build command: docker build -f apps/admin/Dockerfile -t studyflow-admin:latest .

FROM node:22.23.4-alpine AS base
WORKDIR /app

# Stage 1: Install dependencies and build
FROM base AS builder

COPY package.json package-lock.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/shared/package.json ./packages/shared/
COPY apps/admin/package.json ./apps/admin/

RUN npm ci

COPY packages/config/ ./packages/config/
COPY packages/shared/ ./packages/shared/
COPY apps/admin/ ./apps/admin/

# Build shared package then admin app
RUN npm run build --workspace=@studyflow/shared
RUN npm run build --workspace=@studyflow/admin

# Stage 2: Production runner
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3002

USER node

COPY --chown=node:node --from=builder /app/package.json /app/package-lock.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/packages/shared ./packages/shared
COPY --chown=node:node --from=builder /app/apps/admin/package.json ./apps/admin/
COPY --chown=node:node --from=builder /app/apps/admin/.next ./apps/admin/.next

EXPOSE 3002

CMD ["npx", "next", "start", "apps/admin", "-p", "3002"]
