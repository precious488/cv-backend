"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const shared_1 = require("@craft/shared");
const aiController_1 = require("../controllers/aiController");
const router = (0, express_1.Router)();
router.use(shared_1.authenticate);
// Pro users get higher limits; free users get basic AI
const freeLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 10,
    keyGenerator: (req) => req.user?.sub ??
        req.ip ??
        'unknown',
    message: {
        success: false,
        error: 'AI request limit reached. Upgrade to Pro for more.',
    },
});
const proLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 100,
    keyGenerator: (req) => req.user?.sub ??
        req.ip ??
        'unknown',
    message: {
        success: false,
        error: 'AI hourly limit reached. Try again later.',
    },
});
// Autocomplete is available to all, but rate-limited
router.post('/autocomplete', freeLimiter, aiController_1.autocomplete);
// Advanced features require pro
router.post('/improve-summary', proLimiter, aiController_1.improveSummary);
router.post('/bullet-points', proLimiter, aiController_1.generateBulletPoints);
router.post('/suggest-skills', freeLimiter, aiController_1.suggestSkills); // free users get skill suggestions
exports.default = router;
