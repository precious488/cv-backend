"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.refresh = refresh;
exports.logout = logout;
exports.me = me;
exports.changePassword = changePassword;
exports.verifyOtp = verifyOtp;
exports.toggleOtp = toggleOtp;
exports.forgotPassword = forgotPassword;
exports.resetPassword = resetPassword;
const zod_1 = require("zod");
const User_1 = require("../models/User");
const tokens_1 = require("../utils/tokens");
const shared_1 = require("@craft/shared");
const shared_2 = require("@craft/shared");
const shared_3 = require("@craft/shared");
const uuid_1 = require("uuid");
const otp_1 = require("../utils/otp");
const passwordReset_1 = require("../utils/passwordReset");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// ─── Validation schemas ───────────────────────────────────────
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email'),
    password: zod_1.z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain an uppercase letter')
        .regex(/[0-9]/, 'Password must contain a number'),
    fullName: zod_1.z
        .string()
        .min(2, 'Full name must be at least 2 characters')
        .max(100),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1, 'Password is required'),
});
// ─── Register ─────────────────────────────────────────────────
async function register(req, res) {
    const correlationId = req.correlationId ?? (0, uuid_1.v4)();
    const log = shared_1.logger.child({ correlationId, handler: 'register' });
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: parsed.error.flatten().fieldErrors,
            correlationId,
        });
        return;
    }
    const { email, password, fullName } = parsed.data;
    const existing = await User_1.User.findOne({ email });
    if (existing) {
        res.status(409).json({
            success: false,
            error: 'Email already registered',
            correlationId,
        });
        return;
    }
    const user = new User_1.User({ email, password, fullName });
    await user.save();
    const { accessToken, refreshToken } = (0, tokens_1.generateTokens)({
        sub: user.id,
        email: user.email,
        role: user.role,
    });
    // Store hashed refresh token reference
    await User_1.User.findByIdAndUpdate(user.id, {
        $push: { refreshTokens: refreshToken },
    });
    // Publish user.registered event
    await (0, shared_3.publishEvent)({
        eventType: 'user.registered',
        correlationId,
        timestamp: new Date().toISOString(),
        payload: { userId: user.id, email: user.email, fullName: user.fullName },
    });
    log.info({ userId: user.id, email }, 'User registered');
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
    });
}
// ─── Login ────────────────────────────────────────────────────
async function login(req, res) {
    const correlationId = req.correlationId ?? (0, uuid_1.v4)();
    const log = shared_1.logger.child({ correlationId, handler: 'login' });
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            success: false,
            error: 'Invalid credentials format',
            correlationId,
        });
        return;
    }
    const { email, password } = parsed.data;
    const user = await User_1.User.findOne({ email }).select('+password +refreshTokens +otpEnabled');
    if (!user || !(await user.comparePassword(password))) {
        res.status(401).json({
            success: false,
            error: 'Invalid email or password',
            correlationId,
        });
        return;
    }
    // ─── OTP check ───────────────────────────────────────────────
    if (user.otpEnabled) {
        const otp = await (0, otp_1.generateAndStoreOTP)(user.id);
        await (0, otp_1.sendOTPEmail)(user.email, otp, user.fullName);
        // Issue a short-lived temp token so the client can call verify-otp
        const tempToken = jsonwebtoken_1.default.sign({ sub: user.id, purpose: 'otp-verification' }, process.env.JWT_ACCESS_SECRET, { expiresIn: '10m' });
        log.info({ userId: user.id, email }, 'OTP sent for login');
        res.json({
            success: true,
            data: { requiresOtp: true, tempToken },
            correlationId,
        });
        return;
    }
    // ─── Normal login (OTP not enabled) ──────────────────────────
    const { accessToken, refreshToken } = (0, tokens_1.generateTokens)({
        sub: user.id,
        email: user.email,
        role: user.role,
    });
    const updatedTokens = [...(user.refreshTokens ?? []).slice(-4), refreshToken];
    await User_1.User.findByIdAndUpdate(user.id, {
        $set: { refreshTokens: updatedTokens },
    });
    log.info({ userId: user.id, email }, 'User logged in');
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
    });
}
// ─── Refresh token ────────────────────────────────────────────
async function refresh(req, res) {
    const correlationId = req.correlationId ?? (0, uuid_1.v4)();
    const { refreshToken } = req.body;
    if (!refreshToken || typeof refreshToken !== 'string') {
        res
            .status(400)
            .json({ success: false, error: 'Refresh token required', correlationId });
        return;
    }
    let payload;
    try {
        payload = (0, tokens_1.verifyRefreshToken)(refreshToken);
    }
    catch {
        res
            .status(401)
            .json({ success: false, error: 'Invalid refresh token', correlationId });
        return;
    }
    const user = await User_1.User.findById(payload.sub).select('+refreshTokens');
    if (!user || !user.refreshTokens?.includes(refreshToken)) {
        res
            .status(401)
            .json({ success: false, error: 'Refresh token revoked', correlationId });
        return;
    }
    const { accessToken, refreshToken: newRefreshToken } = (0, tokens_1.generateTokens)({
        sub: user.id,
        email: user.email,
        role: user.role,
    });
    // Rotate: remove old, add new
    const updatedTokens = (user.refreshTokens ?? [])
        .filter((t) => t !== refreshToken)
        .concat(newRefreshToken);
    await User_1.User.findByIdAndUpdate(user.id, {
        $set: { refreshTokens: updatedTokens },
    });
    // Invalidate user cache on token rotation
    await (0, shared_2.invalidateCache)(shared_2.cacheKeys.user(user.id));
    res.json({
        success: true,
        data: { accessToken, refreshToken: newRefreshToken },
        correlationId,
    });
}
// ─── Logout ───────────────────────────────────────────────────
async function logout(req, res) {
    const correlationId = req.correlationId ?? (0, uuid_1.v4)();
    const { refreshToken } = req.body;
    const userId = req.user?.sub;
    if (userId && refreshToken) {
        await User_1.User.findByIdAndUpdate(userId, {
            $pull: { refreshTokens: refreshToken },
        });
        await (0, shared_2.invalidateCache)(shared_2.cacheKeys.user(userId));
    }
    res.json({ success: true, message: 'Logged out successfully', correlationId });
}
// ─── Get current user ─────────────────────────────────────────
async function me(req, res) {
    const correlationId = req.correlationId ?? (0, uuid_1.v4)();
    const user = await User_1.User.findById(req.user?.sub);
    if (!user) {
        res
            .status(404)
            .json({ success: false, error: 'User not found', correlationId });
        return;
    }
    res.json({ success: true, data: user, correlationId });
}
// ─── Change password ──────────────────────────────────────────
async function changePassword(req, res) {
    const correlationId = req.correlationId ?? (0, uuid_1.v4)();
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        res
            .status(400)
            .json({ success: false, error: 'Both passwords required', correlationId });
        return;
    }
    const passwordSchema = zod_1.z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/);
    if (!passwordSchema.safeParse(newPassword).success) {
        res.status(400).json({
            success: false,
            error: 'New password does not meet requirements',
            correlationId,
        });
        return;
    }
    const user = await User_1.User.findById(req.user?.sub).select('+password');
    if (!user || !(await user.comparePassword(currentPassword))) {
        res.status(401).json({
            success: false,
            error: 'Current password is incorrect',
            correlationId,
        });
        return;
    }
    user.password = newPassword;
    user.refreshTokens = []; // invalidate all sessions
    await user.save();
    await (0, shared_2.invalidateCache)(shared_2.cacheKeys.user(user.id));
    res.json({
        success: true,
        message: 'Password changed. Please log in again.',
        correlationId,
    });
}
async function verifyOtp(req, res) {
    const correlationId = req.correlationId ?? (0, uuid_1.v4)();
    const { tempToken, otp } = req.body;
    if (!tempToken || !otp) {
        res.status(400).json({
            success: false,
            error: 'tempToken and otp are required',
            correlationId,
        });
        return;
    }
    // Verify temp token
    let payload;
    try {
        payload = jsonwebtoken_1.default.verify(tempToken, process.env.JWT_ACCESS_SECRET);
    }
    catch {
        res.status(401).json({
            success: false,
            error: 'Invalid or expired session',
            correlationId,
        });
        return;
    }
    if (payload.purpose !== 'otp-verification') {
        res
            .status(401)
            .json({ success: false, error: 'Invalid token purpose', correlationId });
        return;
    }
    // Verify OTP
    const valid = await (0, otp_1.verifyOTP)(payload.sub, otp);
    if (!valid) {
        res
            .status(401)
            .json({ success: false, error: 'Invalid or expired OTP', correlationId });
        return;
    }
    // OTP valid — issue real tokens
    const user = await User_1.User.findById(payload.sub).select('+refreshTokens');
    if (!user) {
        res
            .status(404)
            .json({ success: false, error: 'User not found', correlationId });
        return;
    }
    const { accessToken, refreshToken } = (0, tokens_1.generateTokens)({
        sub: user.id,
        email: user.email,
        role: user.role,
    });
    const updatedTokens = [...(user.refreshTokens ?? []).slice(-4), refreshToken];
    await User_1.User.findByIdAndUpdate(user.id, {
        $set: { refreshTokens: updatedTokens },
    });
    shared_1.logger.info({ userId: user.id }, 'OTP verified — user logged in');
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
    });
}
// ─── ADD toggle OTP endpoint ──────────────────────────────────
async function toggleOtp(req, res) {
    const correlationId = req.correlationId ?? (0, uuid_1.v4)();
    const { enabled } = req.body;
    await User_1.User.findByIdAndUpdate(req.user.sub, {
        $set: { otpEnabled: !!enabled },
    });
    shared_1.logger.info({ userId: req.user.sub, otpEnabled: !!enabled }, 'OTP setting changed');
    res.json({
        success: true,
        message: `OTP ${enabled ? 'enabled' : 'disabled'} successfully`,
        correlationId,
    });
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
async function forgotPassword(req, res) {
    const correlationId = req.correlationId ?? (0, uuid_1.v4)();
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
        res
            .status(400)
            .json({ success: false, error: 'Email is required', correlationId });
        return;
    }
    // Always return success even if email not found — prevents user enumeration
    const user = await User_1.User.findOne({ email: email.toLowerCase().trim() });
    if (user) {
        const token = await (0, passwordReset_1.generateResetToken)(user.id);
        await (0, passwordReset_1.sendPasswordResetEmail)(user.email, user.fullName, token);
        shared_1.logger.info({ userId: user.id }, 'Password reset email sent');
    }
    res.json({
        success: true,
        message: 'If that email is registered, a reset link has been sent.',
        correlationId,
    });
}
// ─── Reset password — consume token and update password ───────
async function resetPassword(req, res) {
    const correlationId = req.correlationId ?? (0, uuid_1.v4)();
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
        res.status(400).json({
            success: false,
            error: 'Token and new password are required',
            correlationId,
        });
        return;
    }
    const passwordSchema = zod_1.z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain an uppercase letter')
        .regex(/[0-9]/, 'Password must contain a number');
    if (!passwordSchema.safeParse(newPassword).success) {
        res.status(400).json({
            success: false,
            error: 'Password must be at least 8 characters, include an uppercase letter and a number',
            correlationId,
        });
        return;
    }
    // Verify and consume the token
    const userId = await (0, passwordReset_1.verifyResetToken)(token);
    if (!userId) {
        res.status(400).json({
            success: false,
            error: 'Reset link is invalid or has expired. Please request a new one.',
            correlationId,
        });
        return;
    }
    const user = await User_1.User.findById(userId).select('+password');
    if (!user) {
        res
            .status(404)
            .json({ success: false, error: 'User not found', correlationId });
        return;
    }
    // Update password — the pre-save hook will hash it
    user.password = newPassword;
    user.refreshTokens = []; // invalidate all existing sessions
    await user.save();
    shared_1.logger.info({ userId }, 'Password reset successfully');
    res.json({
        success: true,
        message: 'Password reset successfully. You can now log in with your new password.',
        correlationId,
    });
}
