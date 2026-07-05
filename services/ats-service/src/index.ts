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
import atsRoutes from './routes/ats'

const app = express()
const PORT = process.env.PORT ?? 3005

app.use(helmet())
app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  }),
)
app.use(express.json({ limit: '2mb' }))
app.use(correlationIdMiddleware)
app.use(requestLogger)
app.use('/api/ats', atsRoutes)
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'ats-service' }),
)
app.use(notFoundHandler)
app.use(globalErrorHandler)
// Keep-alive ping every 14 minutes
if (process.env.NODE_ENV === 'production') {
  const GATEWAY_URL = process.env.RENDER_EXTERNAL_URL ?? ''
  if (GATEWAY_URL) {
    setInterval(
      () => {
        fetch(`${GATEWAY_URL}/health`).catch(() => {})
      },
      14 * 60 * 1000,
    )
  }
}

async function bootstrap(): Promise<void> {
  getRedisClient()
  app.listen(PORT, () => logger.info({ port: PORT }, 'ATS service listening'))
}
bootstrap().catch((err) => {
  logger.error({ err }, 'ATS service failed')
  process.exit(1)
})
