# Smartmouth: one container (ADR 0015). Stage 1 builds the web app; stage 2 is Node 24 running the server's
# TypeScript directly (ADR 0003) and serving the built pages. Data (SQLite, voice and picture files) lives in /data.
FROM node:24-alpine AS web
WORKDIR /src
COPY package.json package-lock.json tsconfig.json ./
COPY packages ./packages
COPY apps/server/package.json ./apps/server/package.json
COPY apps/web ./apps/web
RUN npm ci --no-audit --no-fund && npm --workspace @smartmouth/web run build

FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps/server ./apps/server
COPY apps/web/package.json ./apps/web/package.json
# Voice tooling runs inside the container, where the OpenRouter key is (ADR 0013).
COPY tools ./tools
RUN npm ci --omit=dev --no-audit --no-fund --workspace @smartmouth/server --include-workspace-root=false \
    && npm cache clean --force
COPY --from=web /src/apps/web/dist ./apps/web/dist

ENV NODE_ENV=production \
    PORT=8470 \
    DATA_DIR=/data
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
EXPOSE 8470
USER node

HEALTHCHECK --interval=60s --timeout=5s --start-period=10s \
  CMD wget -q -O /dev/null http://127.0.0.1:${PORT}/api/health || exit 1

CMD ["node", "--disable-warning=ExperimentalWarning", "apps/server/src/main.ts"]
