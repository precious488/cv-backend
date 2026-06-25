import { Request, Response } from 'express'
import { z } from 'zod'
import { User } from '../models/User'
import { generateTokens, verifyRefreshToken } from '../utils/tokens'
import { logger } from '@craft/shared/src/utils/logger'
import { invalidateCache, cacheKeys } from '@craft/shared/src/utils/redis'
import { publishEvent } from '@craft/shared/src/events/broker'
import { v4 as uuidv4 } from 'uuid'
import { AuthenticatedRequest } from '../types/shared'

// ─── Validation schemas ───────────────────────────────────────
const registerSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
})

// ─── Register ─────────────────────────────────────────────────
export async function register(req: Request, res: Response): Promise<void> {
  const correlationId = (req as AuthenticatedRequest).correlationId ?? uuidv4()
  const log = logger.child({ correlationId, handler: 'register' })

  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: parsed.error.flatten().fieldErrors,
      correlationId,
    })
    return
  }

  const { email, password, fullName } = parsed.data

  const existing = await User.findOne({ email })
  if (existing) {
    res
      .status(409)
      .json({
        success: false,
        error: 'Email already registered',
        correlationId,
      })
    return
  }

  const user = new User({ email, password, fullName })
  await user.save()

  const { accessToken, refreshToken } = generateTokens({
    sub: user.id,
    email: user.email,
    role: user.role,
  })

  // Store hashed refresh token reference
  await User.findByIdAndUpdate(user.id, {
    $push: { refreshTokens: refreshToken },
  })

  // Publish user.registered event
  await publishEvent({
    eventType: 'user.registered',
    correlationId,
    timestamp: new Date().toISOString(),
    payload: { userId: user.id, email: user.email, fullName: user.fullName },
  })

  log.info({ userId: user.id, email }, 'User registered')

  res.status(201).json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      accessToken,
      refreshToken,
    },
    correlationId,
  })
}

// ─── Login ────────────────────────────────────────────────────
export async function login(req: Request, res: Response): Promise<void> {
  const correlationId = (req as AuthenticatedRequest).correlationId ?? uuidv4()
  const log = logger.child({ correlationId, handler: 'login' })

  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    res
      .status(400)
      .json({
        success: false,
        error: 'Invalid credentials format',
        correlationId,
      })
    return
  }

  const { email, password } = parsed.data

  const user = await User.findOne({ email }).select('+password +refreshTokens')
  if (!user || !(await user.comparePassword(password))) {
    // Constant-time-ish response to prevent enumeration
    res
      .status(401)
      .json({
        success: false,
        error: 'Invalid email or password',
        correlationId,
      })
    return
  }

  const { accessToken, refreshToken } = generateTokens({
    sub: user.id,
    email: user.email,
    role: user.role,
  })

  // Keep only last 5 refresh tokens (device management)
  const updatedTokens = [...(user.refreshTokens ?? []).slice(-4), refreshToken]
  await User.findByIdAndUpdate(user.id, {
    $set: { refreshTokens: updatedTokens },
  })

  log.info({ userId: user.id, email }, 'User logged in')

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      accessToken,
      refreshToken,
    },
    correlationId,
  })
}

// ─── Refresh token ────────────────────────────────────────────
export async function refresh(req: Request, res: Response): Promise<void> {
  const correlationId = (req as AuthenticatedRequest).correlationId ?? uuidv4()
  const { refreshToken } = req.body

  if (!refreshToken || typeof refreshToken !== 'string') {
    res
      .status(400)
      .json({ success: false, error: 'Refresh token required', correlationId })
    return
  }

  let payload: { sub: string }
  try {
    payload = verifyRefreshToken(refreshToken)
  } catch {
    res
      .status(401)
      .json({ success: false, error: 'Invalid refresh token', correlationId })
    return
  }

  const user = await User.findById(payload.sub).select('+refreshTokens')
  if (!user || !user.refreshTokens?.includes(refreshToken)) {
    res
      .status(401)
      .json({ success: false, error: 'Refresh token revoked', correlationId })
    return
  }

  const { accessToken, refreshToken: newRefreshToken } = generateTokens({
    sub: user.id,
    email: user.email,
    role: user.role,
  })

  // Rotate: remove old, add new
  const updatedTokens = (user.refreshTokens ?? [])
    .filter((t) => t !== refreshToken)
    .concat(newRefreshToken)
  await User.findByIdAndUpdate(user.id, {
    $set: { refreshTokens: updatedTokens },
  })

  // Invalidate user cache on token rotation
  await invalidateCache(cacheKeys.user(user.id))

  res.json({
    success: true,
    data: { accessToken, refreshToken: newRefreshToken },
    correlationId,
  })
}

// ─── Logout ───────────────────────────────────────────────────
export async function logout(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const correlationId = req.correlationId ?? uuidv4()
  const { refreshToken } = req.body
  const userId = req.user?.sub

  if (userId && refreshToken) {
    await User.findByIdAndUpdate(userId, {
      $pull: { refreshTokens: refreshToken },
    })
    await invalidateCache(cacheKeys.user(userId))
  }

  res.json({ success: true, message: 'Logged out successfully', correlationId })
}

// ─── Get current user ─────────────────────────────────────────
export async function me(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const correlationId = req.correlationId ?? uuidv4()
  const user = await User.findById(req.user?.sub)
  if (!user) {
    res
      .status(404)
      .json({ success: false, error: 'User not found', correlationId })
    return
  }
  res.json({ success: true, data: user, correlationId })
}

// ─── Change password ──────────────────────────────────────────
export async function changePassword(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const correlationId = req.correlationId ?? uuidv4()
  const { currentPassword, newPassword } = req.body

  if (!currentPassword || !newPassword) {
    res
      .status(400)
      .json({ success: false, error: 'Both passwords required', correlationId })
    return
  }

  const passwordSchema = z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/)
  if (!passwordSchema.safeParse(newPassword).success) {
    res
      .status(400)
      .json({
        success: false,
        error: 'New password does not meet requirements',
        correlationId,
      })
    return
  }

  const user = await User.findById(req.user?.sub).select('+password')
  if (!user || !(await user.comparePassword(currentPassword))) {
    res
      .status(401)
      .json({
        success: false,
        error: 'Current password is incorrect',
        correlationId,
      })
    return
  }

  user.password = newPassword
  user.refreshTokens = [] // invalidate all sessions
  await user.save()

  await invalidateCache(cacheKeys.user(user.id))
  res.json({
    success: true,
    message: 'Password changed. Please log in again.',
    correlationId,
  })
}
