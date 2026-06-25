import { Router } from 'express'
import { authenticate } from '@craft/shared/src/middleware'
import {
  getProfile,
  updateProfile,
  deleteAccount,
} from '../controllers/profileController'

const router = Router()
router.use(authenticate)
router.get('/me', getProfile)
router.put('/me', updateProfile)
router.delete('/me', deleteAccount)

export default router
