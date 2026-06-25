FROM node:20-alpine AS builder
WORKDIR /app

# Copy shared library
COPY shared/ ./shared/
WORKDIR /app/shared
RUN npm ci && npm run build

# Copy service
WORKDIR /app/service
COPY services/auth-service/package*.json ./
RUN npm ci
COPY services/auth-service/ ./
RUN npm run build

# ─── Production image ─────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV SERVICE_NAME=auth-service

RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001

COPY --from=builder --chown=nodeuser:nodejs /app/service/dist ./dist
COPY --from=builder --chown=nodeuser:nodejs /app/service/node_modules ./node_modules
COPY --from=builder --chown=nodeuser:nodejs /app/service/package.json ./

USER nodeuser
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "dist/index.js"]
