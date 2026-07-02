"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const mongoose_1 = __importDefault(require("mongoose"));
const shared_1 = require("@craft/shared");
const shared_2 = require("@craft/shared");
const shared_3 = require("@craft/shared");
const shared_4 = require("@craft/shared");
const cv_1 = __importDefault(require("./routes/cv"));
require("dotenv/config");
const app = (0, express_1.default)();
const PORT = process.env.PORT ?? 3003;
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
}));
app.use(express_1.default.json({ limit: '2mb' })); // resumes can be large
app.use(shared_1.correlationIdMiddleware);
app.use(shared_1.requestLogger);
app.use('/api/resumes', cv_1.default);
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'cv-service',
        timestamp: new Date().toISOString(),
        mongo: mongoose_1.default.connection.readyState === 1 ? 'connected' : 'disconnected',
    });
});
app.use(shared_1.notFoundHandler);
app.use(shared_1.globalErrorHandler);
async function bootstrap() {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri)
        throw new Error('MONGO_URI is required');
    await mongoose_1.default.connect(mongoUri);
    shared_2.logger.info('CV-service: MongoDB connected');
    (0, shared_3.getRedisClient)();
    await (0, shared_4.initBroker)();
    app.listen(PORT, () => shared_2.logger.info({ port: PORT }, 'CV service listening'));
}
bootstrap().catch((err) => {
    shared_2.logger.error({ err }, 'CV service failed to start');
    process.exit(1);
});
process.on('SIGTERM', async () => {
    await mongoose_1.default.disconnect();
    process.exit(0);
});
