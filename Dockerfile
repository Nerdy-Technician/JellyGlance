FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY docs/package.json docs/package.json
RUN npm ci

FROM deps AS web-builder
WORKDIR /app
COPY apps/web apps/web
RUN npm run build -w @jellyglance/web

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
  CONFIG_DIR=/app/config \
  BACKUP_DIR=/app/backups
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends wget \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /app/config /app/backups

COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm ci --omit=dev --workspace @jellyglance/api --include-workspace-root=false

COPY apps/api apps/api
COPY --from=web-builder /app/apps/web/dist apps/web/dist
COPY scripts/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/auth/isConfigured || exit 1

EXPOSE 3000
VOLUME ["/app/config", "/app/backups"]
CMD ["/entrypoint.sh"]
