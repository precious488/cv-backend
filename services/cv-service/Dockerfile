FROM node:20-alpine AS builder
WORKDIR /app

# Copy shared library
COPY shared/ ./shared/
WORKDIR /app/shared
RUN npm ci && npm run build

# Copy service — note the extra /services/ nesting to match ../../shared
WORKDIR /app/services/cv-service
COPY services/cv-service/package*.json ./
RUN npm ci
COPY services/cv-service/ ./
RUN npm run build

# ─── Production image ─────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV SERVICE_NAME=cv-service

RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001

# Replicate the SAME directory depth as the builder stage so the
# @craft/shared symlink inside node_modules resolves correctly
COPY --from=builder --chown=nodeuser:nodejs /app/shared /app/shared
COPY --from=builder --chown=nodeuser:nodejs /app/services/cv-service/dist ./services/cv-service/dist
COPY --from=builder --chown=nodeuser:nodejs /app/services/cv-service/node_modules ./services/cv-service/node_modules
COPY --from=builder --chown=nodeuser:nodejs /app/services/cv-service/package.json ./services/cv-service/package.json

WORKDIR /app/services/cv-service
USER nodeuser
EXPOSE 3003
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3003/health || exit 1

CMD ["npm", "run", "start"]