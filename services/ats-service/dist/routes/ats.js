"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const shared_1 = require("@craft/shared");
const atsController_1 = require("../controllers/atsController");
const router = (0, express_1.Router)();
router.use(shared_1.authenticate);
const atsLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 20,
    message: { success: false, error: 'Too many ATS analysis requests.' },
});
router.post('/analyze', atsLimiter, atsController_1.analyzeResume);
exports.default = router;
