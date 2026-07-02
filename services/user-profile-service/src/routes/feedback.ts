// ─── REPLACE services/user-profile-service/src/routes/feedback.ts entirely with this ───
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate, requireRole } from '@craft/shared'
import {
  submitFeedback,
  getMyFeedback,
  getPublishedFeedback,
  getAllFeedbackAdmin,
  setFeedbackPublished,
  deleteFeedbackAdmin,
} from '../controllers/feedbackController'

const router = Router()

const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: 'Too many feedback submissions. Try again later.',
  },
})

// Public — used by the landing page testimonials section, no auth required
router.get('/published', getPublishedFeedback)

// Authenticated routes
router.use(authenticate)
router.post('/', submitLimiter, submitFeedback)
router.get('/me', getMyFeedback)

// Admin-only routes
router.get('/admin/all', requireRole('admin'), getAllFeedbackAdmin)
router.patch('/admin/:id/publish', requireRole('admin'), setFeedbackPublished)
router.delete('/admin/:id', requireRole('admin'), deleteFeedbackAdmin)

export default router
