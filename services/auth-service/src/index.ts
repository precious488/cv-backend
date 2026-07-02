import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import mongoose from 'mongoose'
import {
  correlationIdMiddleware,
  requestLogger,
  globalErrorHandler,
  notFoundHandler,
} from '@craft/shared'
import { logger } from '@craft/shared'
import { getRedisClient } from '@craft/shared'
import { initBroker } from '@craft/shared'
import authRoutes from './routes/auth'

const app = express()
const PORT = process.env.PORT ?? 3001

// ─── Security middleware ──────────────────────────────────────
app.use(helmet())
app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  }),
)
app.use(express.json({ limit: '10kb' }))
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())

// ─── Observability ────────────────────────────────────────────
app.use(correlationIdMiddleware)
app.use(requestLogger)

// ─── Routes ───────────────────────────────────────────────────
app.use('/api/auth', authRoutes)

// ─── Health check ─────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'auth-service',
    timestamp: new Date().toISOString(),
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  })
})

// ─── Error handling ───────────────────────────────────────────
app.use(notFoundHandler)
app.use(globalErrorHandler)

// ─── Bootstrap ────────────────────────────────────────────────
async function bootstrap(): Promise<void> {
  // MongoDB
  const mongoUri = process.env.MONGO_URI
  if (!mongoUri) throw new Error('MONGO_URI is required')
  await mongoose.connect(mongoUri)
  logger.info('Auth-service: MongoDB connected')

  // Redis
  getRedisClient()

  // RabbitMQ
  await initBroker()

  app.listen(PORT, () => {
    logger.info({ port: PORT }, 'Auth service listening')
  })
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Auth service failed to start')
  process.exit(1)
})

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received — shutting down auth-service')
  await mongoose.disconnect()
  process.exit(0)
})
