import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import mongoose from 'mongoose'
import {
  correlationIdMiddleware,
  requestLogger,
  globalErrorHandler,
  notFoundHandler,
} from '@craft/shared/src/middleware'
import { logger } from '@craft/shared/src/utils/logger'
import { getRedisClient } from '@craft/shared/src/utils/redis'
import { initBroker } from '@craft/shared/src/events/broker'
import { startProfileEventConsumer } from './middleware/eventConsumer'
import profileRoutes from './routes/profile'
import feedbackRoutes from './routes/feedback'
const app = express()
const PORT = process.env.PORT ?? 3002

app.use(helmet())
app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  }),
)
app.use(express.json({ limit: '1mb' }))
app.use(correlationIdMiddleware)
app.use(requestLogger)
app.use('/api/profile', profileRoutes)
app.use('/api/feedback', feedbackRoutes)

app.get('/health', (_req, res) =>
  res.json({
    status: 'ok',
    service: 'user-profile-service',
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  }),
)

app.use(notFoundHandler)
app.use(globalErrorHandler)

async function bootstrap(): Promise<void> {
  await mongoose.connect(process.env.MONGO_URI!)
  logger.info('Profile-service: MongoDB connected')
  getRedisClient()
  await initBroker()
  await startProfileEventConsumer()
  app.listen(PORT, () =>
    logger.info({ port: PORT }, 'Profile service listening'),
  )
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Profile service failed')
  process.exit(1)
})
process.on('SIGTERM', async () => {
  await mongoose.disconnect()
  process.exit(0)
})
