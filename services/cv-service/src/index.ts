import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
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
import cvRoutes from './routes/cv'
import 'dotenv/config'

const app = express()
const PORT = process.env.PORT ?? 3003

app.use(helmet())
app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  }),
)
app.use(express.json({ limit: '2mb' })) // resumes can be large
app.use(correlationIdMiddleware)
app.use(requestLogger)

app.use('/api/resumes', cvRoutes)

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'cv-service',
    timestamp: new Date().toISOString(),
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  })
})

app.use(notFoundHandler)
app.use(globalErrorHandler)

async function bootstrap(): Promise<void> {
  const mongoUri = process.env.MONGO_URI
  if (!mongoUri) throw new Error('MONGO_URI is required')
  await mongoose.connect(mongoUri)
  logger.info('CV-service: MongoDB connected')

  getRedisClient()
  await initBroker()

  app.listen(PORT, () => logger.info({ port: PORT }, 'CV service listening'))
}

bootstrap().catch((err) => {
  logger.error({ err }, 'CV service failed to start')
  process.exit(1)
})

process.on('SIGTERM', async () => {
  await mongoose.disconnect()
  process.exit(0)
})
