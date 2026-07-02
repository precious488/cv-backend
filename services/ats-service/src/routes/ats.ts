import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate } from '@craft/shared'
import { analyzeResume } from '../controllers/atsController'

const router = Router()
router.use(authenticate)

const atsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many ATS analysis requests.' },
})

router.post('/analyze', atsLimiter, analyzeResume)
export default router
