import jwt from 'jsonwebtoken'
import { JwtPayload } from '../types/shared'

interface TokenPair {
  accessToken: string
  refreshToken: string
}

export function generateTokens(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
): TokenPair {
  const accessSecret = process.env.JWT_ACCESS_SECRET!
  const refreshSecret = process.env.JWT_REFRESH_SECRET!

  const accessToken = jwt.sign(payload, accessSecret, {
    expiresIn: (process.env.JWT_ACCESS_EXPIRES ?? '15m') as unknown as number,
  })

  const refreshToken = jwt.sign({ sub: payload.sub }, refreshSecret, {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES ?? '7d') as unknown as number,
  })

  return { accessToken, refreshToken }
}

export function verifyRefreshToken(token: string): { sub: string } {
  const secret = process.env.JWT_REFRESH_SECRET!
  return jwt.verify(token, secret) as { sub: string }
}
