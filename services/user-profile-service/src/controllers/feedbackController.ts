// Replace services/user-profile-service/src/controllers/feedbackController.ts ENTIRELY
import { Response } from 'express'
import { z } from 'zod'
import { Feedback } from '../models/Feedback'
import { AuthenticatedRequest } from '@craft/shared/src/types'
import { logger } from '@craft/shared/src/utils/logger'
import { v4 as uuidv4 } from 'uuid'

const MAX_PHOTO_BYTES = 1_500_000

const feedbackSchema = z.object({
  name: z.string().min(2, 'Name is required').max(100),
  location: z.string().max(100).default(''),
  jobTitle: z.string().max(150).default(''),
  message: z.string().min(10, 'Please share a bit more detail').max(1000),
  rating: z.number().min(1).max(5).optional(),
  photoUrl: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val) return true
        if (!val.startsWith('data:image/')) return false
        return val.length * 0.75 <= MAX_PHOTO_BYTES
      },
      { message: 'Photo must be a valid image under ~1.5MB' },
    ),
})

export async function submitFeedback(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const correlationId = req.correlationId ?? uuidv4()
  const userId = req.user!.sub

  const parsed = feedbackSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: parsed.error.flatten().fieldErrors,
      correlationId,
    })
    return
  }

  const feedback = new Feedback({ ...parsed.data, userId })
  await feedback.save()

  logger.info(
    { userId, feedbackId: feedback.id, hasPhoto: !!parsed.data.photoUrl },
    'Feedback submitted',
  )
  res.status(201).json({ success: true, data: feedback, correlationId })
}

export async function getMyFeedback(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const correlationId = req.correlationId ?? uuidv4()
  const userId = req.user!.sub
  const feedback = await Feedback.find({ userId })
    .sort({ createdAt: -1 })
    .lean()
  res.json({ success: true, data: feedback, correlationId })
}

export async function getPublishedFeedback(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const correlationId = req.correlationId ?? uuidv4()
  const feedback = await Feedback.find({ isPublished: true })
    .sort({ createdAt: -1 })
    .limit(12)
    .select('name location jobTitle message rating photoUrl createdAt')
    .lean()
  res.json({ success: true, data: feedback, correlationId })
}

export async function getAllFeedbackAdmin(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const correlationId = req.correlationId ?? uuidv4()
  if (req.user!.role !== 'admin') {
    res
      .status(403)
      .json({ success: false, error: 'Admin access required', correlationId })
    return
  }
  const feedback = await Feedback.find().sort({ createdAt: -1 }).lean()
  res.json({ success: true, data: feedback, correlationId })
}

export async function setFeedbackPublished(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const correlationId = req.correlationId ?? uuidv4()
  if (req.user!.role !== 'admin') {
    res
      .status(403)
      .json({ success: false, error: 'Admin access required', correlationId })
    return
  }
  const { id } = req.params
  const { isPublished } = req.body as { isPublished: boolean }
  const feedback = await Feedback.findByIdAndUpdate(
    id,
    { $set: { isPublished: !!isPublished } },
    { new: true },
  )
  if (!feedback) {
    res
      .status(404)
      .json({ success: false, error: 'Feedback not found', correlationId })
    return
  }
  logger.info(
    { feedbackId: id, isPublished, adminId: req.user!.sub },
    'Feedback publish status changed',
  )
  res.json({ success: true, data: feedback, correlationId })
}

export async function deleteFeedbackAdmin(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const correlationId = req.correlationId ?? uuidv4()
  if (req.user!.role !== 'admin') {
    res
      .status(403)
      .json({ success: false, error: 'Admin access required', correlationId })
    return
  }
  const { id } = req.params
  await Feedback.findByIdAndDelete(id)
  res.json({ success: true, message: 'Feedback deleted', correlationId })
}
