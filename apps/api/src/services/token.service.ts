import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { AccessTokenPayload, AUTH_LIMITS } from '@studyflow/shared';
import { env } from '../config/env.js';

const JWT_ISSUER = 'studyflow-api';
const JWT_AUDIENCE = 'studyflow-client';

export function createAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as AccessTokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

export function generateRandomToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function getRefreshTokenExpiryDate(): Date {
  const expires = new Date();
  expires.setDate(expires.getDate() + (env.REFRESH_TOKEN_EXPIRES_IN_DAYS || AUTH_LIMITS.refreshTokenExpiryDays));
  return expires;
}
