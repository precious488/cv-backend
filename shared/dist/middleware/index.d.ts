import { Request, Response, NextFunction } from 'express';
import { ApiResponse, JwtPayload } from '../types';
export declare function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void;
export declare function requestLogger(req: Request, res: Response, next: NextFunction): void;
export declare function authenticate(req: Request, res: Response, next: NextFunction): void;
export declare function requireRole(...roles: JwtPayload['role'][]): (req: Request, res: Response, next: NextFunction) => void;
export declare function globalErrorHandler(err: Error & {
    statusCode?: number;
    status?: number;
}, req: Request, res: Response, _next: NextFunction): void;
export declare function notFoundHandler(req: Request, res: Response): void;
export declare function apiSuccess<T>(data: T, correlationId?: string): ApiResponse<T>;
export declare function apiError(error: string, correlationId?: string): ApiResponse;
