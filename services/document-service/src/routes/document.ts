import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate } from '@craft/shared'
import { generateDocument } from '../controllers/documentController'

const router = Router()
router.use(authenticate)

// PDF generation is expensive — strict rate limit
const pdfLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: {
    success: false,
    error: 'PDF generation limit reached. Try again later.',
  },
  keyGenerator: (req) =>
    (req as typeof req & { user?: { sub: string } }).user?.sub ??
    req.ip ??
    'unknown',
})

router.post('/generate', pdfLimiter, generateDocument)

export default router
