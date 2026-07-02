"use strict";
// import { Router } from 'express'
// import rateLimit from 'express-rate-limit'
// import {
//   register,
//   login,
//   refresh,
//   logout,
//   me,
//   changePassword,
//   toggleOtp,
//   verifyOtp,
// } from '../controllers/authController'
// import { authenticate } from '@craft/shared'
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// const router = Router()
// const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 10,
//   standardHeaders: true,
//   legacyHeaders: false,
//   message: {
//     success: false,
//     error: 'Too many authentication attempts. Try again later.',
//   },
// })
// const refreshLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 30,
//   message: { success: false, error: 'Too many refresh attempts.' },
// })
// // Strict rate limit on OTP — prevent brute force
// const otpLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 10,
//   message: { success: false, error: 'Too many OTP attempts. Try again later.' },
// })
// router.post('/register', authLimiter, register)
// router.post('/login', authLimiter, login)
// router.post('/verify-otp', otpLimiter, verifyOtp)
// router.post('/refresh', refreshLimiter, refresh)
// router.post('/logout', authenticate, logout)
// router.get('/me', authenticate, me)
// router.put('/change-password', authenticate, changePassword)
// router.put('/toggle-otp', authenticate, toggleOtp)
// export default router
/**
 * auth.ts — UPDATED ROUTES (includes OTP + password reset)
 * Replace services/auth-service/src/routes/auth.ts ENTIRELY with this.
 */
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const authController_1 = require("../controllers/authController");
const shared_1 = require("@craft/shared");
const router = (0, express_1.Router)();
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many attempts. Try again later.' },
});
const refreshLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { success: false, error: 'Too many refresh attempts.' },
});
const otpLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, error: 'Too many OTP attempts. Try again later.' },
});
// Strict limit on reset requests — prevent abuse
const resetLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour window
    max: 5,
    message: {
        success: false,
        error: 'Too many password reset requests. Try again in an hour.',
    },
});
router.post('/register', authLimiter, authController_1.register);
router.post('/login', authLimiter, authController_1.login);
router.post('/verify-otp', otpLimiter, authController_1.verifyOtp);
router.post('/refresh', refreshLimiter, authController_1.refresh);
router.post('/logout', shared_1.authenticate, authController_1.logout);
router.get('/me', shared_1.authenticate, authController_1.me);
router.put('/change-password', shared_1.authenticate, authController_1.changePassword);
router.put('/toggle-otp', shared_1.authenticate, authController_1.toggleOtp);
// Password reset (public — no auth needed)
router.post('/forgot-password', resetLimiter, authController_1.forgotPassword);
router.post('/reset-password', resetLimiter, authController_1.resetPassword);
exports.default = router;
