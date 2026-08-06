FROM node:20-alpine AS builder
WORKDIR /app

# Copy shared library
COPY shared/ ./shared/
WORKDIR /app/shared
RUN npm ci && npm run build

# Copy service — note the extra /services/ nesting to match ../../shared
WORKDIR /app/services/ats-service
COPY services/ats-service/package*.json ./
RUN npm ci
COPY services/ats-service/ ./
RUN npm run build

# ─── Production image ─────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV SERVICE_NAME=ats-service

RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001

COPY --from=builder --chown=nodeuser:nodejs /app/services/ats-service/dist ./dist
COPY --from=builder --chown=nodeuser:nodejs /app/services/ats-service/node_modules ./node_modules
COPY --from=builder --chown=nodeuser:nodejs /app/services/ats-service/package.json ./

USER nodeuser
EXPOSE 3005
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3005/health || exit 1

CMD ["npm", "run", "start"]