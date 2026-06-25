import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { AuthenticatedRequest, ApiResponse, JwtPayload } from '../types';

// ─── Correlation ID injection ─────────────────────────────────
export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;
  const id =
    (req.headers['x-correlation-id'] as string) ||
    (req.headers['x-request-id'] as string) ||
    uuidv4();
  authReq.correlationId = id;
  res.setHeader('x-correlation-id', id);
  next();
}

// ─── Request logger ───────────────────────────────────────────
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    logger.child({ correlationId: authReq.correlationId }).info(
      {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        ms,
        userId: authReq.user?.sub,
      },
      'HTTP request'
    );
  });
  next();
}

// ─── JWT Auth ─────────────────────────────────────────────────
export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json(apiError('Missing or malformed token', authReq.correlationId));
    return;
  }
  const token = header.slice(7);
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    logger.error('JWT_ACCESS_SECRET not set');
    res.status(500).json(apiError('Server misconfiguration', authReq.correlationId));
    return;
  }
  try {
    const payload = jwt.verify(token, secret) as JwtPayload;
    authReq.user = payload;
    next();
  } catch {
    res.status(401).json(apiError('Invalid or expired token', authReq.correlationId));
  }
}

// ─── Role guard ───────────────────────────────────────────────
export function requireRole(...roles: JwtPayload['role'][]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
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
export function globalErrorHandler(
  err: Error & { statusCode?: number; status?: number },
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;
  const status = err.statusCode ?? err.status ?? 500;
  const message = status < 500 ? err.message : 'Internal server error';
  logger.error(
    { err, correlationId: authReq.correlationId, url: req.originalUrl },
    'Unhandled error'
  );
  res.status(status).json(apiError(message, authReq.correlationId));
}

// ─── Not found handler ────────────────────────────────────────
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json(apiError(`Route ${req.method} ${req.path} not found`));
}

// ─── Response helpers ─────────────────────────────────────────
export function apiSuccess<T>(data: T, correlationId?: string): ApiResponse<T> {
  return { success: true, data, correlationId };
}

export function apiError(error: string, correlationId?: string): ApiResponse {
  return { success: false, error, correlationId };
}
 