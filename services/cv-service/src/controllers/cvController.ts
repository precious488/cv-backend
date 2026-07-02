import { Response } from 'express'
import { z } from 'zod'
import { Resume } from '../models/Resume'
import {
  cacheAside,
  invalidateCache,
  invalidateCachePattern,
  cacheKeys,
} from '@craft/shared'
import { publishEvent } from '@craft/shared'
import { logger } from '@craft/shared'
import { AuthenticatedRequest } from '@craft/shared'
import { v4 as uuidv4 } from 'uuid'

// ─── Validation ───────────────────────────────────────────────
const personalInfoSchema = z.object({
  fullName: z.string().max(150).default(''),
  email: z.string().max(200).default(''),
  phone: z.string().max(50).default(''),
  location: z.string().max(200).default(''),
  title: z.string().max(200).default(''),
  website: z.string().max(500).default(''),
  linkedin: z.string().max(500).default(''),
})

const experienceSchema = z.object({
  id: z.string(),
  company: z.string().max(200).default(''),
  position: z.string().max(200).default(''),
  startDate: z.string().max(50).default(''),
  endDate: z.string().max(50).default(''),
  current: z.boolean().default(false),
  description: z.string().max(5000).default(''),
})

const educationSchema = z.object({
  id: z.string(),
  school: z.string().max(200).default(''),
  degree: z.string().max(200).default(''),
  field: z.string().max(200).default(''),
  startDate: z.string().max(50).default(''),
  endDate: z.string().max(50).default(''),
  description: z.string().max(2000).default(''),
})

const projectSchema = z.object({
  id: z.string(),
  name: z.string().max(200).default(''),
  description: z.string().max(2000).default(''),
  technologies: z.string().max(500).default(''),
  link: z.string().max(500).default(''),
})

const certificationSchema = z.object({
  id: z.string(),
  name: z.string().max(200).default(''),
  issuer: z.string().max(200).default(''),
  date: z.string().max(50).default(''),
})

const resumeSchema = z.object({
  title: z.string().min(1).max(200).default('Untitled Resume'),
  personalInfo: personalInfoSchema.default({}),
  summary: z.string().max(2000).default(''),
  experience: z.array(experienceSchema).default([]),
  education: z.array(educationSchema).default([]),
  skills: z.array(z.string().max(100)).max(100).default([]),
  projects: z.array(projectSchema).default([]),
  certifications: z.array(certificationSchema).default([]),
  languages: z.array(z.string().max(100)).max(50).default([]),
  template: z
    .enum(['modern', 'classic', 'minimal', 'corporate'])
    .default('modern'),
})

// ─── List resumes ─────────────────────────────────────────────
export async function listResumes(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const correlationId = req.correlationId ?? uuidv4()
  const userId = req.user!.sub

  const resumes = await cacheAside(
    cacheKeys.cvList(userId),
    () => Resume.find({ userId }).sort({ updatedAt: -1 }).lean(),
    120, // 2 minutes for list
  )

  res.json({ success: true, data: resumes, correlationId })
}

// ─── Get one resume ───────────────────────────────────────────
export async function getResume(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const correlationId = req.correlationId ?? uuidv4()
  const userId = req.user!.sub
  const { id } = req.params

  const resume = await cacheAside(
    cacheKeys.cv(id),
    async () => {
      const doc = await Resume.findOne({ _id: id, userId }).lean()
      return doc
    },
    300, // 5 minutes for single resume
  )

  if (!resume) {
    res
      .status(404)
      .json({ success: false, error: 'Resume not found', correlationId })
    return
  }

  res.json({ success: true, data: resume, correlationId })
}

// ─── Create resume ────────────────────────────────────────────
export async function createResume(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const correlationId = req.correlationId ?? uuidv4()
  const userId = req.user!.sub

  // Check plan limits: free users max 3 resumes
  // if (//req.user!.role === 'free') {
  //   const count = await Resume.countDocuments({ userId })
  //   if (count >= 3) {
  //     res.status(403).json({
  //       success: false,
  //       error:
  //         'Free plan allows a maximum of 3 resumes. Upgrade to Pro for unlimited resumes.',
  //       correlationId,
  //     })
  //     return
  //   }
  // }

  const parsed = resumeSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: parsed.error.flatten().fieldErrors,
      correlationId,
    })
    return
  }

  const resume = new Resume({ ...parsed.data, userId })
  await resume.save()

  // Write-through: invalidate the list cache
  await invalidateCache(cacheKeys.cvList(userId))

  await publishEvent({
    eventType: 'cv.created',
    correlationId,
    timestamp: new Date().toISOString(),
    payload: { cvId: resume.id, userId, cacheKey: cacheKeys.cv(resume.id) },
  })

  logger.info({ cvId: resume.id, userId }, 'CV created')
  res.status(201).json({ success: true, data: resume, correlationId })
}

// ─── Update resume ────────────────────────────────────────────
export async function updateResume(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const correlationId = req.correlationId ?? uuidv4()
  const userId = req.user!.sub
  const { id } = req.params

  const parsed = resumeSchema.partial().safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: parsed.error.flatten().fieldErrors,
      correlationId,
    })
    return
  }

  const resume = await Resume.findOneAndUpdate(
    { _id: id, userId },
    { $set: parsed.data },
    { new: true, runValidators: true },
  ).lean()

  if (!resume) {
    res
      .status(404)
      .json({ success: false, error: 'Resume not found', correlationId })
    return
  }

  // ─── Write-through cache invalidation (CRITICAL) ──────────
  await invalidateCache(cacheKeys.cv(id), cacheKeys.cvList(userId))

  await publishEvent({
    eventType: 'cv.updated',
    correlationId,
    timestamp: new Date().toISOString(),
    payload: { cvId: id, userId, cacheKey: cacheKeys.cv(id) },
  })

  logger.info({ cvId: id, userId }, 'CV updated')
  res.json({ success: true, data: resume, correlationId })
}

// ─── Delete resume ────────────────────────────────────────────
export async function deleteResume(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const correlationId = req.correlationId ?? uuidv4()
  const userId = req.user!.sub
  const { id } = req.params

  const deleted = await Resume.findOneAndDelete({ _id: id, userId })
  if (!deleted) {
    res
      .status(404)
      .json({ success: false, error: 'Resume not found', correlationId })
    return
  }

  // Write-through: invalidate both specific and list caches
  await invalidateCache(cacheKeys.cv(id), cacheKeys.cvList(userId))
  // Also invalidate any ATS scores for this CV
  await invalidateCachePattern(`ats:${id}:*`)

  await publishEvent({
    eventType: 'cv.deleted',
    correlationId,
    timestamp: new Date().toISOString(),
    payload: { cvId: id, userId, cacheKey: cacheKeys.cv(id) },
  })

  logger.info({ cvId: id, userId }, 'CV deleted')
  res.json({ success: true, message: 'Resume deleted', correlationId })
}

// ─── Duplicate resume ─────────────────────────────────────────
export async function duplicateResume(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const correlationId = req.correlationId ?? uuidv4()
  const userId = req.user!.sub
  const { id } = req.params

  const original = await Resume.findOne({ _id: id, userId }).lean()
  if (!original) {
    res
      .status(404)
      .json({ success: false, error: 'Resume not found', correlationId })
    return
  }

  const { _id, createdAt, updatedAt, ...rest } = original as Record<
    string,
    unknown
  >
  void _id
  void createdAt
  void updatedAt

  const copy = new Resume({
    ...rest,
    title: `${original.title} (Copy)`,
    userId,
  })
  await copy.save()

  await invalidateCache(cacheKeys.cvList(userId))

  res.status(201).json({ success: true, data: copy, correlationId })
}
