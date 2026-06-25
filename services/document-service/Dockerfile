FROM node:20-slim AS builder
WORKDIR /app
COPY shared/ ./shared/
WORKDIR /app/shared
RUN npm ci && npm run build
WORKDIR /app/service
COPY services/document-service/package*.json ./
RUN npm ci
COPY services/document-service/ ./
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app

# Install Chromium dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
  chromium fonts-liberation libgbm1 libnss3 libatk1.0-0 \
  libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 \
  libxdamage1 libxrandr2 libxss1 libxtst6 ca-certificates \
  --no-install-recommends && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV SERVICE_NAME=document-service
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN addgroup --gid 1001 nodejs && adduser --uid 1001 --gid 1001 --disabled-password nodeuser

COPY --from=builder --chown=nodeuser:nodejs /app/service/dist ./dist
COPY --from=builder --chown=nodeuser:nodejs /app/service/node_modules ./node_modules
COPY --from=builder --chown=nodeuser:nodejs /app/service/package.json ./

USER nodeuser
EXPOSE 3004
HEALTHCHECK --interval=30s --timeout=15s --retries=3 \
  CMD wget -qO- http://localhost:3004/health || exit 1
CMD ["node", "dist/index.js"]
