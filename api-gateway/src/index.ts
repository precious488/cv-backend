import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import {
  correlationIdMiddleware,
  requestLogger,
  notFoundHandler,
} from '@craft/shared/src/middleware'
import { logger } from '@craft/shared/src/utils/logger'
import { getRedisClient } from '@craft/shared/src/utils/redis'
import { getCircuitBreakerStats } from './config/circuitBreaker'
import {
  authProxy,
  profileProxy,
  cvProxy,
  documentProxy,
  atsProxy,
  aiProxy,
  feedbackProxy,
} from './middleware/proxy'

const app = express()
const PORT = process.env.PORT ?? 4000

// ─── Security ─────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // handled by nginx
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
)

app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:8080',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id'],
    exposedHeaders: ['x-correlation-id'],
  }),
)

// ─── Global rate limiter (applies to all routes) ──────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP. Please slow down.',
  },
  skip: (req) => req.path === '/health', // never rate-limit health checks
})
app.use(globalLimiter)

// ─── Observability ────────────────────────────────────────────
app.use(correlationIdMiddleware)
app.use(requestLogger)

// ─── Health & status ──────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    circuitBreakers: getCircuitBreakerStats(),
  })
})

// ─── Route table ──────────────────────────────────────────────
//  /api/auth/**      → auth-service:3001
//  /api/profile/**   → user-profile-service:3002
//  /api/resumes/**   → cv-service:3003
//  /api/documents/** → document-service:3004
//  /api/ats/**       → ats-service:3005
//  /api/ai/**        → ai-service:3006

app.use('/api/auth', authProxy)
app.use('/api/profile', profileProxy)
app.use('/api/resumes', cvProxy)
app.use('/api/documents', documentProxy)
app.use('/api/ats', atsProxy)
app.use('/api/ai', aiProxy)
app.use('/api/feedback', feedbackProxy)

app.use(notFoundHandler)

// ─── Startup ──────────────────────────────────────────────────
async function bootstrap(): Promise<void> {
  getRedisClient()
  app.listen(PORT, () => logger.info({ port: PORT }, 'API Gateway listening'))
}

bootstrap().catch((err) => {
  logger.error({ err }, 'API Gateway failed to start')
  process.exit(1)
})

process.on('SIGTERM', () => {
  logger.info('API Gateway shutting down')
  process.exit(0)
})
