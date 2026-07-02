import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types/shared';
export declare function register(req: Request, res: Response): Promise<void>;
export declare function login(req: Request, res: Response): Promise<void>;
export declare function refresh(req: Request, res: Response): Promise<void>;
export declare function logout(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function me(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function changePassword(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function verifyOtp(req: Request, res: Response): Promise<void>;
export declare function toggleOtp(req: AuthenticatedRequest, res: Response): Promise<void>;
/**
 * authController-password-reset-additions.ts
 *
 * ADD these two functions to:
 * services/auth-service/src/controllers/authController.ts
 * (paste at the bottom of the file after changePassword)
 *
 * Also add this import at the top of authController.ts:
 * import { generateResetToken, verifyResetToken, sendPasswordResetEmail } from '../utils/passwordReset';
 */
export declare function forgotPassword(req: Request, res: Response): Promise<void>;
export declare function resetPassword(req: Request, res: Response): Promise<void>;
