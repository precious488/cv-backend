import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import {
  register,
  login,
  refresh,
  logout,
  me,
  changePassword,
} from '../controllers/authController'
import { authenticate } from '@craft/shared/src/middleware'

const router = Router()

// Strict rate limiting on auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many authentication attempts. Try again later.',
  },
})

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, error: 'Too many refresh attempts.' },
})

router.post('/register', authLimiter, register)
router.post('/login', authLimiter, login)
router.post('/refresh', refreshLimiter, refresh)
router.post('/logout', authenticate, logout)
router.get('/me', authenticate, me)
router.put('/change-password', authenticate, changePassword)

export default router
