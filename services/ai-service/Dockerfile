FROM node:20-alpine AS builder
WORKDIR /app
COPY shared/ ./shared/
WORKDIR /app/shared
RUN npm ci && npm run build
WORKDIR /app/service
COPY services/ai-service/package*.json ./
RUN npm ci
COPY services/ai-service/ ./
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV SERVICE_NAME=ai-service
RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001
COPY --from=builder --chown=nodeuser:nodejs /app/service/dist ./dist
COPY --from=builder --chown=nodeuser:nodejs /app/service/node_modules ./node_modules
COPY --from=builder --chown=nodeuser:nodejs /app/service/package.json ./
USER nodeuser
EXPOSE 3006
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3006/health || exit 1
CMD ["node", "dist/index.js"]
