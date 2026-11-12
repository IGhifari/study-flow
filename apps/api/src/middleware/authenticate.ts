import { Request, Response, NextFunction } from 'express';
import { COOKIE_NAMES, ADMIN_COOKIE_NAMES, Role } from '@studyflow/shared';
import { verifyAccessToken } from '../services/token.service.js';
import { prisma } from '@studyflow/database';
import { AppError } from './errorHandler.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role?: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function resolveAuthenticatedUser(
  req: Request,
  options?: { preferAdminCookie?: boolean }
): Promise<{ id: string; email: string; role: Role }> {
  let token: string | undefined;

  // 1. Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  // 2. Fallback to cookies
  if (!token && req.cookies) {
    token = options?.preferAdminCookie
      ? req.cookies[ADMIN_COOKIE_NAMES.accessToken] || req.cookies[COOKIE_NAMES.accessToken]
      : req.cookies[COOKIE_NAMES.accessToken] || req.cookies[ADMIN_COOKIE_NAMES.accessToken];
  }

  if (!token) {
    const error: AppError = new Error('Autentikasi diperlukan. Token tidak ditemukan.');
    error.statusCode = 401;
    error.code = 'UNAUTHORIZED';
    throw error;
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    const error: AppError = new Error('Token akses tidak valid atau telah kedaluwarsa.');
    error.statusCode = 401;
    error.code = 'INVALID_OR_EXPIRED_TOKEN';
    throw error;
  }

  // Verify user still exists and tokenVersion matches (handles immediate token revocation on password change)
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, role: true, tokenVersion: true },
  });

  if (!user || user.tokenVersion !== payload.tokenVersion) {
    const error: AppError = new Error('Sesi telah dicabut atau diubah. Silakan login kembali.');
    error.statusCode = 401;
    error.code = 'SESSION_REVOKED';
    throw error;
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role as Role,
  };
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await resolveAuthenticatedUser(req);
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
