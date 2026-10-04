import { Response } from 'express';
import { COOKIE_NAMES, AUTH_LIMITS } from '@studyflow/shared';
import { env } from '../config/env.js';

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken?: string
): void {
  const isProduction = env.NODE_ENV === 'production';

  res.cookie(COOKIE_NAMES.accessToken, accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: AUTH_LIMITS.accessTokenExpirySeconds * 1000,
  });

  if (refreshToken) {
    res.cookie(COOKIE_NAMES.refreshToken, refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: (env.REFRESH_TOKEN_EXPIRES_IN_DAYS || AUTH_LIMITS.refreshTokenExpiryDays) * 24 * 60 * 60 * 1000,
    });
  }
}

export function clearAuthCookies(res: Response): void {
  const isProduction = env.NODE_ENV === 'production';

  res.clearCookie(COOKIE_NAMES.accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  });

  res.clearCookie(COOKIE_NAMES.refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  });
}
