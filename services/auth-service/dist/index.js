"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const mongoose_1 = __importDefault(require("mongoose"));
const shared_1 = require("@craft/shared");
const shared_2 = require("@craft/shared");
const shared_3 = require("@craft/shared");
const shared_4 = require("@craft/shared");
const auth_1 = __importDefault(require("./routes/auth"));
const app = (0, express_1.default)();
const PORT = process.env.PORT ?? 3001;
// ─── Security middleware ──────────────────────────────────────
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
}));
app.use(express_1.default.json({ limit: '10kb' }));
app.use(express_1.default.urlencoded({ extended: false }));
app.use((0, cookie_parser_1.default)());
// ─── Observability ────────────────────────────────────────────
app.use(shared_1.correlationIdMiddleware);
app.use(shared_1.requestLogger);
// ─── Routes ───────────────────────────────────────────────────
app.use('/api/auth', auth_1.default);
// ─── Health check ─────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'auth-service',
        timestamp: new Date().toISOString(),
        mongo: mongoose_1.default.connection.readyState === 1 ? 'connected' : 'disconnected',
    });
});
// ─── Error handling ───────────────────────────────────────────
app.use(shared_1.notFoundHandler);
app.use(shared_1.globalErrorHandler);
// ─── Bootstrap ────────────────────────────────────────────────
async function bootstrap() {
    // MongoDB
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri)
        throw new Error('MONGO_URI is required');
    await mongoose_1.default.connect(mongoUri);
    shared_2.logger.info('Auth-service: MongoDB connected');
    // Redis
    (0, shared_3.getRedisClient)();
    // RabbitMQ
    await (0, shared_4.initBroker)();
    app.listen(PORT, () => {
        shared_2.logger.info({ port: PORT }, 'Auth service listening');
    });
}
bootstrap().catch((err) => {
    shared_2.logger.error({ err }, 'Auth service failed to start');
    process.exit(1);
});
process.on('SIGTERM', async () => {
    shared_2.logger.info('SIGTERM received — shutting down auth-service');
    await mongoose_1.default.disconnect();
    process.exit(0);
});
