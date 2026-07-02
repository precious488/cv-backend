"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// ─── REPLACE services/user-profile-service/src/routes/feedback.ts entirely with this ───
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const shared_1 = require("@craft/shared");
const feedbackController_1 = require("../controllers/feedbackController");
const router = (0, express_1.Router)();
const submitLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: {
        success: false,
        error: 'Too many feedback submissions. Try again later.',
    },
});
// Public — used by the landing page testimonials section, no auth required
router.get('/published', feedbackController_1.getPublishedFeedback);
// Authenticated routes
router.use(shared_1.authenticate);
router.post('/', submitLimiter, feedbackController_1.submitFeedback);
router.get('/me', feedbackController_1.getMyFeedback);
// Admin-only routes
router.get('/admin/all', (0, shared_1.requireRole)('admin'), feedbackController_1.getAllFeedbackAdmin);
router.patch('/admin/:id/publish', (0, shared_1.requireRole)('admin'), feedbackController_1.setFeedbackPublished);
router.delete('/admin/:id', (0, shared_1.requireRole)('admin'), feedbackController_1.deleteFeedbackAdmin);
exports.default = router;
