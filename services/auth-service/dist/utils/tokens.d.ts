import { JwtPayload } from '../types/shared';
interface TokenPair {
    accessToken: string;
    refreshToken: string;
}
export declare function generateTokens(payload: Omit<JwtPayload, 'iat' | 'exp'>): TokenPair;
export declare function verifyRefreshToken(token: string): {
    sub: string;
};
export {};
