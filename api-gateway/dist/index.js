"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const shared_1 = require("@craft/shared");
const shared_2 = require("@craft/shared");
const shared_3 = require("@craft/shared");
const circuitBreaker_1 = require("./config/circuitBreaker");
const proxy_1 = require("./middleware/proxy");
const app = (0, express_1.default)();
const PORT = process.env.PORT ?? 4000;
// ─── Security ─────────────────────────────────────────────────
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false, // handled by nginx
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:8080',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id'],
    exposedHeaders: ['x-correlation-id'],
}));
// ─── Global rate limiter (applies to all routes) ──────────────
const globalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Too many requests from this IP. Please slow down.',
    },
    skip: (req) => req.path === '/health', // never rate-limit health checks
});
app.use(globalLimiter);
// ─── Observability ────────────────────────────────────────────
app.use(shared_1.correlationIdMiddleware);
app.use(shared_1.requestLogger);
// ─── Health & status ──────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'api-gateway',
        timestamp: new Date().toISOString(),
        circuitBreakers: (0, circuitBreaker_1.getCircuitBreakerStats)(),
    });
});
// ─── Route table ──────────────────────────────────────────────
//  /api/auth/**      → auth-service:3001
//  /api/profile/**   → user-profile-service:3002
//  /api/resumes/**   → cv-service:3003
//  /api/documents/** → document-service:3004
//  /api/ats/**       → ats-service:3005
//  /api/ai/**        → ai-service:3006
app.use('/api/auth', proxy_1.authProxy);
app.use('/api/profile', proxy_1.profileProxy);
app.use('/api/resumes', proxy_1.cvProxy);
app.use('/api/documents', proxy_1.documentProxy);
app.use('/api/ats', proxy_1.atsProxy);
app.use('/api/ai', proxy_1.aiProxy);
app.use('/api/feedback', proxy_1.feedbackProxy);
app.use(shared_1.notFoundHandler);
// ─── Startup ──────────────────────────────────────────────────
async function bootstrap() {
    (0, shared_3.getRedisClient)();
    app.listen(PORT, () => shared_2.logger.info({ port: PORT }, 'API Gateway listening'));
}
bootstrap().catch((err) => {
    shared_2.logger.error({ err }, 'API Gateway failed to start');
    process.exit(1);
});
process.on('SIGTERM', () => {
    shared_2.logger.info('API Gateway shutting down');
    process.exit(0);
});
