import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import {
  correlationIdMiddleware,
  requestLogger,
  globalErrorHandler,
  notFoundHandler,
} from '@craft/shared/src//middleware'
import { logger } from '@craft/shared/src//utils/logger'
import { getRedisClient } from '@craft/shared/src//utils/redis'
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

async function bootstrap(): Promise<void> {
  getRedisClient()
  app.listen(PORT, () => logger.info({ port: PORT }, 'ATS service listening'))
}
bootstrap().catch((err) => {
  logger.error({ err }, 'ATS service failed')
  process.exit(1)
})
