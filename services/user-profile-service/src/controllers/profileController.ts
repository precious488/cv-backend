import { Response } from 'express'
import { z } from 'zod'
import { UserProfile } from '../models/UserProfile'
import {
  cacheAside,
  invalidateCache,
  cacheKeys,
} from '@craft/shared'
import { AuthenticatedRequest } from '@craft/shared'
import { logger } from '@craft/shared'
import { v4 as uuidv4 } from 'uuid'

const updateSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  bio: z.string().max(500).optional(),
  jobTitle: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
  website: z.string().url().max(500).optional().or(z.literal('')),
  linkedin: z.string().max(500).optional(),
  github: z.string().max(500).optional(),
  phone: z.string().max(50).optional(),
  preferences: z
    .object({
      defaultTemplate: z
        .enum(['modern', 'classic', 'minimal', 'corporate'])
        .optional(),
      emailNotifications: z.boolean().optional(),
      theme: z.enum(['light', 'dark', 'system']).optional(),
    })
    .optional(),
})

export async function getProfile(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const correlationId = req.correlationId ?? uuidv4()
  const userId = req.user!.sub

  const profile = await cacheAside(
    cacheKeys.profile(userId),
    () => UserProfile.findOne({ userId }).lean(),
    300,
  )

  if (!profile) {
    res
      .status(404)
      .json({ success: false, error: 'Profile not found', correlationId })
    return
  }
  res.json({ success: true, data: profile, correlationId })
}

export async function updateProfile(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const correlationId = req.correlationId ?? uuidv4()
  const userId = req.user!.sub

  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: parsed.error.flatten().fieldErrors,
      correlationId,
    })
    return
  }

  const profile = await UserProfile.findOneAndUpdate(
    { userId },
    { $set: parsed.data },
    { new: true, upsert: true, runValidators: true },
  ).lean()

  // Write-through cache invalidation
  await invalidateCache(cacheKeys.profile(userId))

  logger.info({ userId }, 'Profile updated')
  res.json({ success: true, data: profile, correlationId })
}

export async function deleteAccount(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const correlationId = req.correlationId ?? uuidv4()
  const userId = req.user!.sub

  await UserProfile.findOneAndDelete({ userId })
  await invalidateCache(cacheKeys.profile(userId))

  logger.info({ userId }, 'Profile deleted (account removal)')
  res.json({ success: true, message: 'Account data removed', correlationId })
}
