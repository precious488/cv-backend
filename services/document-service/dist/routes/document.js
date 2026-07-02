"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const shared_1 = require("@craft/shared");
const documentController_1 = require("../controllers/documentController");
const router = (0, express_1.Router)();
router.use(shared_1.authenticate);
// PDF generation is expensive — strict rate limit
const pdfLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    message: {
        success: false,
        error: 'PDF generation limit reached. Try again later.',
    },
    keyGenerator: (req) => req.user?.sub ??
        req.ip ??
        'unknown',
});
router.post('/generate', pdfLimiter, documentController_1.generateDocument);
exports.default = router;
