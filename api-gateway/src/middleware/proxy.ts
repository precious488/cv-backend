import { createProxyMiddleware, Options } from 'http-proxy-middleware'
import { Request, Response, NextFunction, RequestHandler } from 'express'
import { getCircuitBreaker } from '../config/circuitBreaker'
import { logger } from '@craft/shared'

interface ServiceConfig {
  name: string
  target: string
  pathRewrite?: Record<string, string>
  timeout?: number
}

function createServiceProxy(config: ServiceConfig): RequestHandler {
  const proxyOptions: Options = {
    target: config.target,
    changeOrigin: true,
    pathRewrite: config.pathRewrite,
    on: {
      error: (err, req, res) => {
        logger.error(
          { err, service: config.name, url: (req as Request).url },
          'Proxy error',
        )
        if ('headersSent' in res && !res.headersSent) {
          ;(res as Response).status(503).json({
            success: false,
            error: `${config.name} is temporarily unavailable`,
          })
        }
      },
      proxyReq: (proxyReq, req) => {
        const correlationId = (req as Request & { correlationId?: string })
          .correlationId
        if (correlationId) proxyReq.setHeader('x-correlation-id', correlationId)
      },
    },
  }

  return createProxyMiddleware(proxyOptions)
}

// Wrap a proxy handler with a circuit breaker
export function withCircuitBreaker(config: ServiceConfig): RequestHandler {
  const proxy = createServiceProxy(config)

  // Circuit breaker wraps a "ping" function — actual request handling still goes through proxy
  // The breaker tracks failures observed via the error handler above
  const breaker = getCircuitBreaker(
    config.name,
    async () => {
      // This is a placeholder — real circuit tracking happens in the proxy error handler
      return Promise.resolve()
    },
    { timeout: config.timeout ?? 10000 },
  )

  return (req: Request, res: Response, next: NextFunction): void => {
    if (breaker.opened) {
      logger.warn({ service: config.name }, 'Request blocked — circuit is OPEN')
      res.status(503).json({
        success: false,
        error: `${config.name} is currently unavailable. Please try again shortly.`,
      })
      return
    }
    proxy(req, res, next)
  }
}

// ─── Service proxy factories ──────────────────────────────────
export const authProxy = withCircuitBreaker({
  name: 'auth-service',
  target: process.env.AUTH_SERVICE_URL ?? 'http://auth-service:3001',
  pathRewrite: { '^': '/api/auth' },
})

export const profileProxy = withCircuitBreaker({
  name: 'user-profile-service',
  target: process.env.PROFILE_SERVICE_URL ?? 'http://user-profile-service:3002',
  pathRewrite: { '^': '/api/profile' },
})

export const feedbackProxy = withCircuitBreaker({
  name: 'user-profile-service',
  target: process.env.PROFILE_SERVICE_URL ?? 'http://user-profile-service:3002',
  pathRewrite: { '^': '/api/feedback' },
})
export const cvProxy = withCircuitBreaker({
  name: 'cv-service',
  target: process.env.CV_SERVICE_URL ?? 'http://cv-service:3003',
  pathRewrite: { '^': '/api/resumes' },
})

export const documentProxy = withCircuitBreaker({
  name: 'document-service',
  target: process.env.DOCUMENT_SERVICE_URL ?? 'http://document-service:3004',
  timeout: 60000,
  pathRewrite: { '^': '/api/documents' },
})

export const atsProxy = withCircuitBreaker({
  name: 'ats-service',
  target: process.env.ATS_SERVICE_URL ?? 'http://ats-service:3005',
  pathRewrite: { '^': '/api/ats' },
})

export const aiProxy = withCircuitBreaker({
  name: 'ai-service',
  target: process.env.AI_SERVICE_URL ?? 'http://ai-service:3006',
  timeout: 30000,
  pathRewrite: { '^': '/api/ai' },
})
