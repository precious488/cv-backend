FROM node:20-alpine AS builder
WORKDIR /app
COPY shared/ ./shared/
WORKDIR /app/shared
RUN npm ci && npm run build
WORKDIR /app/gateway
COPY api-gateway/package*.json ./
RUN npm ci
COPY api-gateway/ ./
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV SERVICE_NAME=api-gateway
RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001
COPY --from=builder --chown=nodeuser:nodejs /app/gateway/dist ./dist
COPY --from=builder --chown=nodeuser:nodejs /app/gateway/node_modules ./node_modules
COPY --from=builder --chown=nodeuser:nodejs /app/gateway/package.json ./
USER nodeuser
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1
CMD ["node", "dist/index.js"]
