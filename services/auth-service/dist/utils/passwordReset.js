"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateResetToken = generateResetToken;
exports.verifyResetToken = verifyResetToken;
exports.sendPasswordResetEmail = sendPasswordResetEmail;
/**
 * passwordReset.ts
 * Drop into services/auth-service/src/utils/passwordReset.ts
 */
const crypto_1 = __importDefault(require("crypto"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const shared_1 = require("@craft/shared");
const shared_2 = require("@craft/shared");
const RESET_TTL_SECONDS = 900; // 15 minutes
const RESET_KEY_PREFIX = 'pwd-reset:';
// ─── Generate & store reset token ────────────────────────────
async function generateResetToken(userId) {
    const token = crypto_1.default.randomBytes(32).toString('hex');
    const key = `${RESET_KEY_PREFIX}${token}`;
    // Store userId under the token key
    await (0, shared_1.getRedisClient)().setex(key, RESET_TTL_SECONDS, userId);
    shared_2.logger.debug({ userId }, 'Password reset token generated');
    return token;
}
// ─── Verify & consume token (one-time use) ───────────────────
async function verifyResetToken(token) {
    const key = `${RESET_KEY_PREFIX}${token}`;
    const userId = await (0, shared_1.getRedisClient)().get(key);
    if (!userId)
        return null;
    // Consume immediately — token can only be used once
    await (0, shared_1.getRedisClient)().del(key);
    shared_2.logger.debug({ userId }, 'Password reset token consumed');
    return userId;
}
// ─── Send reset email ─────────────────────────────────────────
let _transporter = null;
function getTransporter() {
    if (_transporter)
        return _transporter;
    _transporter = nodemailer_1.default.createTransport({
        host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
    return _transporter;
}
async function sendPasswordResetEmail(email, fullName, token) {
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:8080';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
    await getTransporter().sendMail({
        from: `"ResumeAI" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Reset your ResumeAI password',
        text: `Hi ${fullName},\n\nClick the link below to reset your password. This link expires in 15 minutes.\n\n${resetUrl}\n\nIf you did not request a password reset, you can safely ignore this email.\n\n— The ResumeAI Team`,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <h1 style="color: white; margin: 0; font-size: 24px;">ResumeAI</h1>
        </div>
        <h2 style="color: #1a1a2e; font-size: 18px;">Reset your password</h2>
        <p style="color: #555; font-size: 14px;">Hi ${fullName},</p>
        <p style="color: #555; font-size: 14px;">
          We received a request to reset the password for your ResumeAI account.
          Click the button below to choose a new password:
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${resetUrl}"
             style="background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white;
                    text-decoration: none; padding: 14px 32px; border-radius: 10px;
                    font-weight: bold; font-size: 15px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="color: #888; font-size: 12px;">
          Or copy and paste this link into your browser:<br/>
          <a href="${resetUrl}" style="color: #4f46e5; word-break: break-all;">${resetUrl}</a>
        </p>
        <p style="color: #888; font-size: 12px;">
          This link expires in <strong>15 minutes</strong> and can only be used once.
        </p>
        <p style="color: #888; font-size: 12px;">
          If you did not request a password reset, you can safely ignore this email.
          Your password will not be changed.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #bbb; font-size: 11px; text-align: center;">— The ResumeAI Team</p>
      </div>
    `,
    });
    shared_2.logger.info({ email }, 'Password reset email sent');
}
