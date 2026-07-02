"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.correlationIdMiddleware = correlationIdMiddleware;
exports.requestLogger = requestLogger;
exports.authenticate = authenticate;
exports.requireRole = requireRole;
exports.globalErrorHandler = globalErrorHandler;
exports.notFoundHandler = notFoundHandler;
exports.apiSuccess = apiSuccess;
exports.apiError = apiError;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const logger_1 = require("../utils/logger");
// ─── Correlation ID injection ─────────────────────────────────
function correlationIdMiddleware(req, res, next) {
    const authReq = req;
    const id = req.headers['x-correlation-id'] ||
        req.headers['x-request-id'] ||
        (0, uuid_1.v4)();
    authReq.correlationId = id;
    res.setHeader('x-correlation-id', id);
    next();
}
// ─── Request logger ───────────────────────────────────────────
function requestLogger(req, res, next) {
    const authReq = req;
    const start = Date.now();
    res.on('finish', () => {
        const ms = Date.now() - start;
        logger_1.logger.child({ correlationId: authReq.correlationId }).info({
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            ms,
            userId: authReq.user?.sub,
        }, 'HTTP request');
    });
    next();
}
// ─── JWT Auth ─────────────────────────────────────────────────
function authenticate(req, res, next) {
    const authReq = req;
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        res.status(401).json(apiError('Missing or malformed token', authReq.correlationId));
        return;
    }
    const token = header.slice(7);
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
        logger_1.logger.error('JWT_ACCESS_SECRET not set');
        res.status(500).json(apiError('Server misconfiguration', authReq.correlationId));
        return;
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, secret);
        authReq.user = payload;
        next();
    }
    catch {
        res.status(401).json(apiError('Invalid or expired token', authReq.correlationId));
    }
}
// ─── Role guard ───────────────────────────────────────────────
function requireRole(...roles) {
    return (req, res, next) => {
        const authReq = req;
        if (!authReq.user) {
            res.status(401).json(apiError('Unauthenticated', authReq.correlationId));
            return;
        }
        if (!roles.includes(authReq.user.role)) {
            res.status(403).json(apiError('Insufficient permissions', authReq.correlationId));
            return;
        }
        next();
    };
}
// ─── Global error handler ─────────────────────────────────────
function globalErrorHandler(err, req, res, _next) {
    const authReq = req;
    const status = err.statusCode ?? err.status ?? 500;
    const message = status < 500 ? err.message : 'Internal server error';
    logger_1.logger.error({ err, correlationId: authReq.correlationId, url: req.originalUrl }, 'Unhandled error');
    res.status(status).json(apiError(message, authReq.correlationId));
}
// ─── Not found handler ────────────────────────────────────────
function notFoundHandler(req, res) {
    res.status(404).json(apiError(`Route ${req.method} ${req.path} not found`));
}
// ─── Response helpers ─────────────────────────────────────────
function apiSuccess(data, correlationId) {
    return { success: true, data, correlationId };
}
function apiError(error, correlationId) {
    return { success: false, error, correlationId };
}
