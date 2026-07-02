export declare function generateResetToken(userId: string): Promise<string>;
export declare function verifyResetToken(token: string): Promise<string | null>;
export declare function sendPasswordResetEmail(email: string, fullName: string, token: string): Promise<void>;
