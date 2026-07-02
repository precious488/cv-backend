export declare function generateAndStoreOTP(userId: string): Promise<string>;
export declare function verifyOTP(userId: string, inputOtp: string): Promise<boolean>;
export declare function sendOTPEmail(email: string, otp: string, fullName: string): Promise<void>;
