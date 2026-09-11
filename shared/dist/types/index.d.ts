import { Request } from 'express';
export interface JwtPayload {
    sub: string;
    email: string;
    role: 'free' | 'pro' | 'admin';
    iat?: number;
    exp?: number;
}
export interface AuthenticatedRequest extends Request {
    user?: JwtPayload;
    correlationId?: string;
}
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    correlationId?: string;
}
export type EventType = 'user.registered' | 'user.deleted' | 'user.flagged' | 'cv.created' | 'cv.updated' | 'cv.deleted' | 'document.generate.requested' | 'document.generate.completed' | 'document.generate.failed';
export interface BaseEvent<T = unknown> {
    eventType: EventType;
    correlationId: string;
    timestamp: string;
    payload: T;
}
export interface UserRegisteredPayload {
    userId: string;
    email: string;
    fullName: string;
}
export interface CvMutatedPayload {
    cvId: string;
    userId: string;
    cacheKey: string;
}
export interface DocumentGeneratePayload {
    cvId: string;
    userId: string;
    resumeData: unknown;
    template: string;
    format: 'pdf' | 'docx';
    correlationId: string;
}
export interface UserFlaggedPayload {
    userId: string;
    reason: 'brute_force' | 'ai_abuse' | 'document_abuse' | 'malicious_input' | 'account_farming';
    detail?: string;
}
