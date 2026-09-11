FROM node:20-alpine AS builder
WORKDIR /app

# Skip Puppeteer's own Chrome download during npm ci — we install
# Chromium via apk in the runner stage instead (Alpine/musl compatible)
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Copy shared library
COPY shared/ ./shared/
WORKDIR /app/shared
RUN npm ci && npm run build

# Copy service — note the extra /services/ nesting to match ../../shared
WORKDIR /app/services/document-service
COPY services/document-service/package*.json ./
RUN npm ci
COPY services/document-service/ ./
RUN npm run build

# ─── Production image ─────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV SERVICE_NAME=document-service

# Install Chromium + required system libs from Alpine's package repo,
# and tell Puppeteer to use this binary instead of its own bundled download
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001

# Replicate the SAME directory depth as the builder stage so the
# @craft/shared symlink inside node_modules resolves correctly
COPY --from=builder --chown=nodeuser:nodejs /app/shared /app/shared
COPY --from=builder --chown=nodeuser:nodejs /app/services/document-service/dist ./services/document-service/dist
COPY --from=builder --chown=nodeuser:nodejs /app/services/document-service/node_modules ./services/document-service/node_modules
COPY --from=builder --chown=nodeuser:nodejs /app/services/document-service/package.json ./services/document-service/package.json

WORKDIR /app/services/document-service
USER nodeuser
EXPOSE 3004
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3004/health || exit 1

CMD ["npm", "run", "start"]