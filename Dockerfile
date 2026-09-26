# amd64 + arm64 use Node 24 LTS; linux/arm/v7 (TARGETARCH=arm) uses Node 22
# because node:24-bookworm-slim has no arm/v7 variant.
ARG TARGETARCH

FROM node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS node-amd64
FROM node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS node-arm64
FROM node:22-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c AS node-arm

FROM node-${TARGETARCH} AS deps
WORKDIR /app
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
RUN npm ci

FROM deps AS web-builder
WORKDIR /app
COPY apps/web apps/web
RUN npm run build -w @jellyglance/web

ARG TARGETARCH
FROM node-${TARGETARCH} AS runtime
ENV NODE_ENV=production \
  CONFIG_DIR=/app/config \
  BACKUP_DIR=/app/backups
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 wget fontconfig fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /app/config /app/backups

COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm ci --omit=dev --workspace @jellyglance/api --include-workspace-root=false

COPY apps/api apps/api
COPY --from=web-builder /app/apps/web/dist apps/web/dist
COPY apps/web/src/whats-new.json apps/web/src/whats-new.json
COPY scripts/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/auth/isConfigured || exit 1

EXPOSE 3000
VOLUME ["/app/config", "/app/backups"]
CMD ["/entrypoint.sh"]
