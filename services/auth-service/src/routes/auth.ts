// import { Router } from 'express'
// import rateLimit from 'express-rate-limit'
// import {
//   register,
//   login,
//   refresh,
//   logout,
//   me,
//   changePassword,
//   toggleOtp,
//   verifyOtp,
// } from '../controllers/authController'
// import { authenticate } from '@craft/shared'

// const router = Router()

// const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 10,
//   standardHeaders: true,
//   legacyHeaders: false,
//   message: {
//     success: false,
//     error: 'Too many authentication attempts. Try again later.',
//   },
// })

// const refreshLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 30,
//   message: { success: false, error: 'Too many refresh attempts.' },
// })

// // Strict rate limit on OTP — prevent brute force
// const otpLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 10,
//   message: { success: false, error: 'Too many OTP attempts. Try again later.' },
// })

// router.post('/register', authLimiter, register)
// router.post('/login', authLimiter, login)
// router.post('/verify-otp', otpLimiter, verifyOtp)
// router.post('/refresh', refreshLimiter, refresh)
// router.post('/logout', authenticate, logout)
// router.get('/me', authenticate, me)
// router.put('/change-password', authenticate, changePassword)
// router.put('/toggle-otp', authenticate, toggleOtp)

// export default router
/**
 * auth.ts — UPDATED ROUTES (includes OTP + password reset)
 * Replace services/auth-service/src/routes/auth.ts ENTIRELY with this.
 */
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import {
  register,
  login,
  refresh,
  logout,
  me,
  changePassword,
  verifyOtp,
  toggleOtp,
  forgotPassword,
  resetPassword,
} from '../controllers/authController'
import { authenticate } from '@craft/shared'

const router = Router()

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many attempts. Try again later.' },
})

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, error: 'Too many refresh attempts.' },
})

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many OTP attempts. Try again later.' },
})

// Strict limit on reset requests — prevent abuse
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 5,
  message: {
    success: false,
    error: 'Too many password reset requests. Try again in an hour.',
  },
})

router.post('/register', authLimiter, register)
router.post('/login', authLimiter, login)
router.post('/verify-otp', otpLimiter, verifyOtp)
router.post('/refresh', refreshLimiter, refresh)
router.post('/logout', authenticate, logout)
router.get('/me', authenticate, me)
router.put('/change-password', authenticate, changePassword)
router.put('/toggle-otp', authenticate, toggleOtp)

// Password reset (public — no auth needed)
router.post('/forgot-password', resetLimiter, forgotPassword)
router.post('/reset-password', resetLimiter, resetPassword)

export default router
