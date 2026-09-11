FROM node:20-alpine AS builder
WORKDIR /app

# Copy shared library
COPY shared/ ./shared/
WORKDIR /app/shared
RUN npm ci && npm run build

# Copy service — note the extra /services/ nesting to match ../../shared
WORKDIR /app/services/auth-service
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

# Replicate the SAME directory depth as the builder stage so the
# @craft/shared symlink inside node_modules resolves correctly
COPY --from=builder --chown=nodeuser:nodejs /app/shared /app/shared
COPY --from=builder --chown=nodeuser:nodejs /app/services/auth-service/dist ./services/auth-service/dist
COPY --from=builder --chown=nodeuser:nodejs /app/services/auth-service/node_modules ./services/auth-service/node_modules
COPY --from=builder --chown=nodeuser:nodejs /app/services/auth-service/package.json ./services/auth-service/package.json

WORKDIR /app/services/auth-service
USER nodeuser
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["npm", "run", "start"]