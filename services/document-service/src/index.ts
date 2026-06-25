import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import {
  correlationIdMiddleware,
  requestLogger,
  globalErrorHandler,
  notFoundHandler,
} from '@craft/shared/src/middleware'
import { logger } from '@craft/shared/src/utils/logger'
import { initBroker } from '@craft/shared/src/events/broker'
import documentRoutes from './routes/document'

const app = express()
const PORT = process.env.PORT ?? 3004

app.use(helmet())
app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  }),
)
app.use(express.json({ limit: '5mb' }))
app.use(correlationIdMiddleware)
app.use(requestLogger)
app.use('/api/documents', documentRoutes)

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'document-service' }),
)
app.use(notFoundHandler)
app.use(globalErrorHandler)

async function bootstrap(): Promise<void> {
  await initBroker()
  app.listen(PORT, () =>
    logger.info({ port: PORT }, 'Document service listening'),
  )
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Document service failed')
  process.exit(1)
})
