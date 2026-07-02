import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import {
  correlationIdMiddleware,
  requestLogger,
  globalErrorHandler,
  notFoundHandler,
} from '@craft/shared'
import { logger } from '@craft/shared'
import { getRedisClient } from '@craft/shared'
import aiRoutes from './routes/ai'

const app = express()
const PORT = process.env.PORT ?? 3006

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
app.use('/api/ai', aiRoutes)
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'ai-service' }),
)
app.use(notFoundHandler)
app.use(globalErrorHandler)

async function bootstrap(): Promise<void> {
  getRedisClient()
  app.listen(PORT, () => logger.info({ port: PORT }, 'AI service listening'))
}
bootstrap().catch((err) => {
  logger.error({ err }, 'AI service failed')
  process.exit(1)
})
