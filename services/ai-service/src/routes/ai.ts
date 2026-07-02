import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate, requireRole } from '@craft/shared'
import {
  improveSummary,
  generateBulletPoints,
  suggestSkills,
  autocomplete,
} from '../controllers/aiController'

const router = Router()
router.use(authenticate)

// Pro users get higher limits; free users get basic AI
const freeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) =>
    (req as typeof req & { user?: { sub: string } }).user?.sub ??
    req.ip ??
    'unknown',
  message: {
    success: false,
    error: 'AI request limit reached. Upgrade to Pro for more.',
  },
})

const proLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  keyGenerator: (req) =>
    (req as typeof req & { user?: { sub: string } }).user?.sub ??
    req.ip ??
    'unknown',
  message: {
    success: false,
    error: 'AI hourly limit reached. Try again later.',
  },
})

// Autocomplete is available to all, but rate-limited
router.post('/autocomplete', freeLimiter, autocomplete)

// Advanced features require pro
router.post('/improve-summary', proLimiter, improveSummary)
router.post('/bullet-points', proLimiter, generateBulletPoints)
router.post('/suggest-skills', freeLimiter, suggestSkills) // free users get skill suggestions

export default router
