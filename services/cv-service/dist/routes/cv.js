"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const cvController_1 = require("../controllers/cvController");
const shared_1 = require("@craft/shared");
const router = (0, express_1.Router)();
// All CV routes require authentication
router.use(shared_1.authenticate);
const writeLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 60,
    message: { success: false, error: 'Too many requests. Try again later.' },
});
const readLimiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000,
    max: 120,
    message: { success: false, error: 'Too many requests. Slow down.' },
});
router.get('/', readLimiter, cvController_1.listResumes);
router.get('/:id', readLimiter, cvController_1.getResume);
router.post('/', writeLimiter, cvController_1.createResume);
router.put('/:id', writeLimiter, cvController_1.updateResume);
router.delete('/:id', writeLimiter, cvController_1.deleteResume);
router.post('/:id/duplicate', writeLimiter, cvController_1.duplicateResume);
exports.default = router;
