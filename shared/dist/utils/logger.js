"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.createCorrelatedLogger = createCorrelatedLogger;
const pino_1 = __importDefault(require("pino"));
const isDev = process.env.NODE_ENV !== 'production';
exports.logger = (0, pino_1.default)({
    level: process.env.LOG_LEVEL ?? 'info',
    transport: isDev
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
        : undefined,
    base: {
        service: process.env.SERVICE_NAME ?? 'unknown-service',
        env: process.env.NODE_ENV,
    },
    timestamp: pino_1.default.stdTimeFunctions.isoTime,
    formatters: {
        level(label) {
            return { level: label };
        },
    },
    redact: {
        paths: ['req.headers.authorization', 'password', 'refreshToken', '*.password'],
        censor: '[REDACTED]',
    },
});
/** Create a child logger bound to a correlationId */
function createCorrelatedLogger(correlationId) {
    return exports.logger.child({ correlationId });
}
