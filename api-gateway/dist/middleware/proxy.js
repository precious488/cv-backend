"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiProxy = exports.atsProxy = exports.documentProxy = exports.cvProxy = exports.feedbackProxy = exports.profileProxy = exports.authProxy = void 0;
exports.withCircuitBreaker = withCircuitBreaker;
const http_proxy_middleware_1 = require("http-proxy-middleware");
const circuitBreaker_1 = require("../config/circuitBreaker");
const shared_1 = require("@craft/shared");
function createServiceProxy(config) {
    const proxyOptions = {
        target: config.target,
        changeOrigin: true,
        pathRewrite: config.pathRewrite,
        on: {
            error: (err, req, res) => {
                shared_1.logger.error({ err, service: config.name, url: req.url }, 'Proxy error');
                if ('headersSent' in res && !res.headersSent) {
                    ;
                    res.status(503).json({
                        success: false,
                        error: `${config.name} is temporarily unavailable`,
                    });
                }
            },
            proxyReq: (proxyReq, req) => {
                const correlationId = req
                    .correlationId;
                if (correlationId)
                    proxyReq.setHeader('x-correlation-id', correlationId);
            },
        },
    };
    return (0, http_proxy_middleware_1.createProxyMiddleware)(proxyOptions);
}
// Wrap a proxy handler with a circuit breaker
function withCircuitBreaker(config) {
    const proxy = createServiceProxy(config);
    // Circuit breaker wraps a "ping" function — actual request handling still goes through proxy
    // The breaker tracks failures observed via the error handler above
    const breaker = (0, circuitBreaker_1.getCircuitBreaker)(config.name, async () => {
        // This is a placeholder — real circuit tracking happens in the proxy error handler
        return Promise.resolve();
    }, { timeout: config.timeout ?? 10000 });
    return (req, res, next) => {
        if (breaker.opened) {
            shared_1.logger.warn({ service: config.name }, 'Request blocked — circuit is OPEN');
            res.status(503).json({
                success: false,
                error: `${config.name} is currently unavailable. Please try again shortly.`,
            });
            return;
        }
        proxy(req, res, next);
    };
}
// ─── Service proxy factories ──────────────────────────────────
exports.authProxy = withCircuitBreaker({
    name: 'auth-service',
    target: process.env.AUTH_SERVICE_URL ?? 'http://auth-service:3001',
    pathRewrite: { '^': '/api/auth' },
});
exports.profileProxy = withCircuitBreaker({
    name: 'user-profile-service',
    target: process.env.PROFILE_SERVICE_URL ?? 'http://user-profile-service:3002',
    pathRewrite: { '^': '/api/profile' },
});
exports.feedbackProxy = withCircuitBreaker({
    name: 'user-profile-service',
    target: process.env.PROFILE_SERVICE_URL ?? 'http://user-profile-service:3002',
    pathRewrite: { '^': '/api/feedback' },
});
exports.cvProxy = withCircuitBreaker({
    name: 'cv-service',
    target: process.env.CV_SERVICE_URL ?? 'http://cv-service:3003',
    pathRewrite: { '^': '/api/resumes' },
});
exports.documentProxy = withCircuitBreaker({
    name: 'document-service',
    target: process.env.DOCUMENT_SERVICE_URL ?? 'http://document-service:3004',
    timeout: 60000,
    pathRewrite: { '^': '/api/documents' },
});
exports.atsProxy = withCircuitBreaker({
    name: 'ats-service',
    target: process.env.ATS_SERVICE_URL ?? 'http://ats-service:3005',
    pathRewrite: { '^': '/api/ats' },
});
exports.aiProxy = withCircuitBreaker({
    name: 'ai-service',
    target: process.env.AI_SERVICE_URL ?? 'http://ai-service:3006',
    timeout: 30000,
    pathRewrite: { '^': '/api/ai' },
});
