import { Request, Response } from 'express'
import { z } from 'zod'
import { User } from '../models/User'
import { generateTokens, verifyRefreshToken } from '../utils/tokens'
import { logger } from '@craft/shared'
import { invalidateCache, cacheKeys } from '@craft/shared'
import { publishEvent } from '@craft/shared'
import { v4 as uuidv4 } from 'uuid'
import { AuthenticatedRequest } from '../types/shared'
import { generateAndStoreOTP, sendOTPEmail, verifyOTP } from '../utils/otp'
import { incrementWithExpiry } from '@craft/shared' // ← add to imports
import {
  generateResetToken,
  verifyResetToken,
  sendPasswordResetEmail,
} from '../utils/passwordReset'
import jwt from 'jsonwebtoken'

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
    res.status(409).json({
      success: false,
      error: 'Email already registered',
      correlationId,
    })
    return
  }

  const ip = req.ip ?? 'unknown'
  const registrationsFromIp = await incrementWithExpiry(
    `reg:ip:${ip}`,
    24 * 60 * 60,
  )
  const isSuspicious = registrationsFromIp > 5

  const user = new User({
    email,
    password,
    fullName,
    registrationIp: ip,
    ...(isSuspicious && {
      flagged: true,
      flagReason: 'account_farming',
      flaggedAt: new Date(),
    }),
  })
  await user.save()

  if (isSuspicious) {
    log.warn(
      { userId: user.id, ip, registrationsFromIp },
      'Registration flagged — possible account farming',
    )
  }

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
    res.status(400).json({
      success: false,
      error: 'Invalid credentials format',
      correlationId,
    })
    return
  }

  const { email, password } = parsed.data

  //
  const user = await User.findOne({ email }).select(
    '+password +refreshTokens +otpEnabled',
  )

  // ─── Brute-force lockout check ─────────────────────────────
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil(
      (user.lockedUntil.getTime() - Date.now()) / 60000,
    )
    res.status(423).json({
      success: false,
      error: `Account temporarily locked from repeated failed logins. Try again in ${minutesLeft} minute(s).`,
      correlationId,
    })
    return
  }

  if (!user || !(await user.comparePassword(password))) {
    if (user) {
      const attempts = (user.failedLoginAttempts ?? 0) + 1
      const update: Record<string, unknown> = { failedLoginAttempts: attempts }
      if (attempts >= 5) {
        update.lockedUntil = new Date(Date.now() + 15 * 60 * 1000)
        update.flagged = true
        update.flagReason = 'brute_force'
        update.flaggedAt = new Date()
        update.failedLoginAttempts = 0
        logger.warn(
          { userId: user.id },
          'Account auto-locked — brute-force threshold reached',
        )
      }
      await User.findByIdAndUpdate(user.id, { $set: update })
    }
    res.status(401).json({
      success: false,
      error: 'Invalid email or password',
      correlationId,
    })
    return
  }

  // Reset counter on success
  if (user.failedLoginAttempts) {
    await User.findByIdAndUpdate(user.id, {
      $set: { failedLoginAttempts: 0, lockedUntil: undefined },
    })
  }

  // (isBlocked check from earlier goes here, unchanged)
  if (user.isBlocked) {
    res.status(403).json({
      success: false,
      error: 'This account has been blocked. Contact support for help.',
      correlationId,
    })
    return
  }

  // ─── OTP check ──────────────────────────────────────────────

  // ─── OTP check ───────────────────────────────────────────────
  if (user.otpEnabled) {
    const otp = await generateAndStoreOTP(user.id)
    await sendOTPEmail(user.email, otp, user.fullName)

    // Issue a short-lived temp token so the client can call verify-otp
    const tempToken = jwt.sign(
      { sub: user.id, purpose: 'otp-verification' },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: '10m' },
    )

    log.info({ userId: user.id, email }, 'OTP sent for login')
    res.json({
      success: true,
      data: { requiresOtp: true, tempToken },
      correlationId,
    })
    return
  }

  // ─── Normal login (OTP not enabled) ──────────────────────────
  const { accessToken, refreshToken } = generateTokens({
    sub: user.id,
    email: user.email,
    role: user.role,
  })

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
    res.status(400).json({
      success: false,
      error: 'New password does not meet requirements',
      correlationId,
    })
    return
  }

  const user = await User.findById(req.user?.sub).select('+password')
  if (!user || !(await user.comparePassword(currentPassword))) {
    res.status(401).json({
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

export async function verifyOtp(req: Request, res: Response): Promise<void> {
  const correlationId = (req as AuthenticatedRequest).correlationId ?? uuidv4()
  const { tempToken, otp } = req.body as { tempToken: string; otp: string }

  if (!tempToken || !otp) {
    res.status(400).json({
      success: false,
      error: 'tempToken and otp are required',
      correlationId,
    })
    return
  }

  // Verify temp token
  let payload: { sub: string; purpose: string }
  try {
    payload = jwt.verify(
      tempToken,
      process.env.JWT_ACCESS_SECRET!,
    ) as typeof payload
  } catch {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired session',
      correlationId,
    })
    return
  }

  if (payload.purpose !== 'otp-verification') {
    res
      .status(401)
      .json({ success: false, error: 'Invalid token purpose', correlationId })
    return
  }

  // Verify OTP
  const valid = await verifyOTP(payload.sub, otp)
  if (!valid) {
    res
      .status(401)
      .json({ success: false, error: 'Invalid or expired OTP', correlationId })
    return
  }

  // OTP valid — issue real tokens
  const user = await User.findById(payload.sub).select('+refreshTokens')
  if (!user) {
    res
      .status(404)
      .json({ success: false, error: 'User not found', correlationId })
    return
  }

  const { accessToken, refreshToken } = generateTokens({
    sub: user.id,
    email: user.email,
    role: user.role,
  })

  const updatedTokens = [...(user.refreshTokens ?? []).slice(-4), refreshToken]
  await User.findByIdAndUpdate(user.id, {
    $set: { refreshTokens: updatedTokens },
  })

  logger.info({ userId: user.id }, 'OTP verified — user logged in')

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

// ─── ADD toggle OTP endpoint ──────────────────────────────────
export async function toggleOtp(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const correlationId = req.correlationId ?? uuidv4()
  const { enabled } = req.body as { enabled: boolean }

  await User.findByIdAndUpdate(req.user!.sub, {
    $set: { otpEnabled: !!enabled },
  })
  logger.info(
    { userId: req.user!.sub, otpEnabled: !!enabled },
    'OTP setting changed',
  )

  res.json({
    success: true,
    message: `OTP ${enabled ? 'enabled' : 'disabled'} successfully`,
    correlationId,
  })
}

/**
 * authController-password-reset-additions.ts
 *
 * ADD these two functions to:
 * services/auth-service/src/controllers/authController.ts
 * (paste at the bottom of the file after changePassword)
 *
 * Also add this import at the top of authController.ts:
 * import { generateResetToken, verifyResetToken, sendPasswordResetEmail } from '../utils/passwordReset';
 */
// import { z } from 'zod';

// ─── Forgot password — send reset email ───────────────────────
export async function forgotPassword(
  req: Request,
  res: Response,
): Promise<void> {
  const correlationId = (req as AuthenticatedRequest).correlationId ?? uuidv4()

  const { email } = req.body as { email: string }
  if (!email || typeof email !== 'string') {
    res
      .status(400)
      .json({ success: false, error: 'Email is required', correlationId })
    return
  }

  // Always return success even if email not found — prevents user enumeration
  const user = await User.findOne({ email: email.toLowerCase().trim() })
  if (user) {
    const token = await generateResetToken(user.id)
    await sendPasswordResetEmail(user.email, user.fullName, token)
    logger.info({ userId: user.id }, 'Password reset email sent')
  }

  res.json({
    success: true,
    message: 'If that email is registered, a reset link has been sent.',
    correlationId,
  })
}

// ─── Reset password — consume token and update password ───────
export async function resetPassword(
  req: Request,
  res: Response,
): Promise<void> {
  const correlationId = (req as AuthenticatedRequest).correlationId ?? uuidv4()

  const { token, newPassword } = req.body as {
    token: string
    newPassword: string
  }

  if (!token || !newPassword) {
    res.status(400).json({
      success: false,
      error: 'Token and new password are required',
      correlationId,
    })
    return
  }

  const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number')

  if (!passwordSchema.safeParse(newPassword).success) {
    res.status(400).json({
      success: false,
      error:
        'Password must be at least 8 characters, include an uppercase letter and a number',
      correlationId,
    })
    return
  }

  // Verify and consume the token
  const userId = await verifyResetToken(token)
  if (!userId) {
    res.status(400).json({
      success: false,
      error: 'Reset link is invalid or has expired. Please request a new one.',
      correlationId,
    })
    return
  }

  const user = await User.findById(userId).select('+password')
  if (!user) {
    res
      .status(404)
      .json({ success: false, error: 'User not found', correlationId })
    return
  }

  // Update password — the pre-save hook will hash it
  user.password = newPassword
  user.refreshTokens = [] // invalidate all existing sessions
  await user.save()

  logger.info({ userId }, 'Password reset successfully')

  res.json({
    success: true,
    message:
      'Password reset successfully. You can now log in with your new password.',
    correlationId,
  })
}

// ─── Admin: list users ─────────────────────────────────────────
const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  status: z.enum(['all', 'blocked', 'active']).default('all'),
  flagged: z.coerce.boolean().optional(),
})

export async function listUsers(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const correlationId = req.correlationId ?? uuidv4()
  const parsed = listUsersQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: 'Invalid query params',
      details: parsed.error.flatten().fieldErrors,
      correlationId,
    })
    return
  }
  const { page, limit, search, status, flagged } = parsed.data

  const filter: Record<string, unknown> = {}
  if (search) {
    filter.$or = [
      { email: { $regex: search, $options: 'i' } },
      { fullName: { $regex: search, $options: 'i' } },
    ]
  }
  if (status === 'blocked') filter.isBlocked = true
  if (status === 'active') filter.isBlocked = false
  if (typeof flagged === 'boolean') filter.flagged = flagged

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ])

  res.json({
    success: true,
    data: {
      users,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
    correlationId,
  })
}

// ─── Admin: block user ─────────────────────────────────────────
export async function blockUser(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const correlationId = req.correlationId ?? uuidv4()
  const { id } = req.params
  const { reason } = req.body as { reason?: string }

  if (id === req.user!.sub) {
    res.status(400).json({
      success: false,
      error: 'You cannot block your own account',
      correlationId,
    })
    return
  }

  const target = await User.findById(id)
  if (!target) {
    res
      .status(404)
      .json({ success: false, error: 'User not found', correlationId })
    return
  }
  if (target.role === 'admin') {
    res.status(403).json({
      success: false,
      error: 'Admin accounts cannot be blocked',
      correlationId,
    })
    return
  }

  target.isBlocked = true
  target.blockedAt = new Date()
  target.blockedReason = reason?.trim() || undefined
  target.refreshTokens = []
  await target.save()

  await invalidateCache(cacheKeys.user(target.id))
  logger.info(
    { userId: target.id, byAdmin: req.user!.sub, reason },
    'User blocked',
  )

  res.json({
    success: true,
    message: 'User blocked',
    data: target,
    correlationId,
  })
}

// ─── Admin: unblock user ───────────────────────────────────────
export async function unblockUser(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const correlationId = req.correlationId ?? uuidv4()
  const { id } = req.params

  const target = await User.findById(id)
  if (!target) {
    res
      .status(404)
      .json({ success: false, error: 'User not found', correlationId })
    return
  }

  target.isBlocked = false
  target.blockedAt = undefined
  target.blockedReason = undefined
  await target.save()

  await invalidateCache(cacheKeys.user(target.id))
  logger.info({ userId: target.id, byAdmin: req.user!.sub }, 'User unblocked')

  res.json({
    success: true,
    message: 'User unblocked',
    data: target,
    correlationId,
  })
}
