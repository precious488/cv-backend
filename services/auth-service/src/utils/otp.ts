/**
 * otp.ts
 * Drop into services/auth-service/src/utils/otp.ts
 *
 * Handles:
 * - Generating a 6-digit OTP
 * - Storing it in Redis with a 10-minute TTL
 * - Sending it via Nodemailer (SMTP / Gmail)
 * - Verifying it (one-time use — deleted after first check)
 */
import nodemailer from 'nodemailer'
import crypto from 'crypto'
import { getRedisClient } from '@craft/shared'
import { logger } from '@craft/shared'

const OTP_TTL_SECONDS = 600 // 10 minutes
const OTP_KEY_PREFIX = 'otp:'

// ─── Generate & store ─────────────────────────────────────────
export async function generateAndStoreOTP(userId: string): Promise<string> {
  const otp = String(Math.floor(100000 + crypto.randomInt(900000))).padStart(
    6,
    '0',
  )
  const key = `${OTP_KEY_PREFIX}${userId}`
  await getRedisClient().setex(key, OTP_TTL_SECONDS, otp)
  logger.debug({ userId }, 'OTP generated and stored')
  return otp
}

// ─── Verify & consume (one-time use) ─────────────────────────
export async function verifyOTP(
  userId: string,
  inputOtp: string,
): Promise<boolean> {
  const key = `${OTP_KEY_PREFIX}${userId}`
  const stored = await getRedisClient().get(key)
  if (!stored) return false
  const valid = stored === inputOtp.trim()
  if (valid) {
    await getRedisClient().del(key) // consume immediately
    logger.debug({ userId }, 'OTP verified and consumed')
  }
  return valid
}

// ─── Nodemailer transporter ───────────────────────────────────
let _transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
  if (_transporter) return _transporter

  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true', 
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS, 
    },
  })

  return _transporter
}

// ─── Send OTP email ───────────────────────────────────────────
export async function sendOTPEmail(
  email: string,
  otp: string,
  fullName: string,
): Promise<void> {
  const transporter = getTransporter()

  await transporter.sendMail({
    from: `"ResumeAI" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `Your ResumeAI login code: ${otp}`,
    text: `Hi ${fullName},\n\nYour one-time login code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, please ignore this email.\n\n— The ResumeAI Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <h1 style="color: white; margin: 0; font-size: 24px;">ResumeAI</h1>
        </div>
        <h2 style="color: #1a1a2e; font-size: 18px;">Your login verification code</h2>
        <p style="color: #555; font-size: 14px;">Hi ${fullName},</p>
        <p style="color: #555; font-size: 14px;">Use the code below to complete your sign-in:</p>
        <div style="background: #f5f5ff; border: 2px solid #4f46e5; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
          <span style="font-size: 40px; font-weight: bold; letter-spacing: 12px; color: #4f46e5;">${otp}</span>
        </div>
        <p style="color: #888; font-size: 12px;">This code expires in <strong>10 minutes</strong> and can only be used once.</p>
        <p style="color: #888; font-size: 12px;">If you did not request this code, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #bbb; font-size: 11px; text-align: center;">— The ResumeAI Team</p>
      </div>
    `,
  })

  logger.info({ email }, 'OTP email sent')
}
