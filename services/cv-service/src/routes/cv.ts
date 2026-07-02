import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import {
  listResumes,
  getResume,
  createResume,
  updateResume,
  deleteResume,
  duplicateResume,
} from '../controllers/cvController'
import { authenticate } from '@craft/shared'

const router = Router()

// All CV routes require authentication
router.use(authenticate)

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { success: false, error: 'Too many requests. Try again later.' },
})

const readLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 120,
  message: { success: false, error: 'Too many requests. Slow down.' },
})

router.get('/', readLimiter, listResumes)
router.get('/:id', readLimiter, getResume)
router.post('/', writeLimiter, createResume)
router.put('/:id', writeLimiter, updateResume)
router.delete('/:id', writeLimiter, deleteResume)
router.post('/:id/duplicate', writeLimiter, duplicateResume)

export default router
