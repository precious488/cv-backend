FROM node:20-alpine AS builder
WORKDIR /app

# Copy shared library
COPY shared/ ./shared/
WORKDIR /app/shared
RUN npm ci && npm run build

WORKDIR /app/gateway
COPY api-gateway/package*.json ./
RUN npm ci
COPY api-gateway/ ./
RUN npm run build

# ─── Production image ─────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV SERVICE_NAME=api-gateway

RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001

# Replicate the SAME directory depth as the builder stage so the
# @craft/shared symlink inside node_modules resolves correctly
COPY --from=builder --chown=nodeuser:nodejs /app/shared /app/shared
COPY --from=builder --chown=nodeuser:nodejs /app/gateway/dist ./gateway/dist
COPY --from=builder --chown=nodeuser:nodejs /app/gateway/node_modules ./gateway/node_modules
COPY --from=builder --chown=nodeuser:nodejs /app/gateway/package.json ./gateway/package.json

WORKDIR /app/gateway
USER nodeuser
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "dist/index.js"]