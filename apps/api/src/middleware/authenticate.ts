import { Request, Response, NextFunction } from 'express';
import { COOKIE_NAMES } from '@studyflow/shared';
import { verifyAccessToken } from '../services/token.service.js';
import { prisma } from '@studyflow/database';
import { AppError } from './errorHandler.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  let token: string | undefined;

  // 1. Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  // 2. Fallback to cookies
  if (!token && req.cookies) {
    token = req.cookies[COOKIE_NAMES.accessToken];
  }

  if (!token) {
    const error: AppError = new Error('Autentikasi diperlukan. Token tidak ditemukan.');
    error.statusCode = 401;
    error.code = 'UNAUTHORIZED';
    return next(error);
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    const error: AppError = new Error('Token akses tidak valid atau telah kedaluwarsa.');
    error.statusCode = 401;
    error.code = 'INVALID_OR_EXPIRED_TOKEN';
    return next(error);
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
    return next(error);
  }

  // Strict separation: Reject ADMIN users from accessing student endpoints
  if (user.role === 'ADMIN') {
    const error: AppError = new Error('Akun administrator tidak diizinkan mengakses portal mahasiswa.');
    error.statusCode = 403;
    error.code = 'ADMIN_PORTAL_ONLY';
    return next(error);
  }

  req.user = {
    id: user.id,
    email: user.email,
  };

  next();
}
