"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const shared_1 = require("@craft/shared");
const shared_2 = require("@craft/shared");
const shared_3 = require("@craft/shared");
const ats_1 = __importDefault(require("./routes/ats"));
const app = (0, express_1.default)();
const PORT = process.env.PORT ?? 3005;
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
}));
app.use(express_1.default.json({ limit: '2mb' }));
app.use(shared_1.correlationIdMiddleware);
app.use(shared_1.requestLogger);
app.use('/api/ats', ats_1.default);
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'ats-service' }));
app.use(shared_1.notFoundHandler);
app.use(shared_1.globalErrorHandler);
async function bootstrap() {
    (0, shared_3.getRedisClient)();
    app.listen(PORT, () => shared_2.logger.info({ port: PORT }, 'ATS service listening'));
}
bootstrap().catch((err) => {
    shared_2.logger.error({ err }, 'ATS service failed');
    process.exit(1);
});
