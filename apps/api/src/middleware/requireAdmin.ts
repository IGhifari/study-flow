import { Request, Response, NextFunction } from 'express';
import { COOKIE_NAMES, ADMIN_COOKIE_NAMES, Role } from '@studyflow/shared';
import { verifyAccessToken } from '../services/token.service.js';
import { prisma } from '@studyflow/database';
import { AppError } from './errorHandler.js';

export interface AuthenticatedAdminUser {
  id: string;
  email: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      adminUser?: AuthenticatedAdminUser;
    }
  }
}

export async function requireAdmin(
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

  // 2. Check admin cookies first, fallback to user cookies
  if (!token && req.cookies) {
    token = req.cookies[ADMIN_COOKIE_NAMES.accessToken] || req.cookies[COOKIE_NAMES.accessToken];
  }

  if (!token) {
    const error: AppError = new Error('Autentikasi admin diperlukan. Token tidak ditemukan.');
    error.statusCode = 401;
    error.code = 'UNAUTHORIZED';
    return next(error);
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    const error: AppError = new Error('Token akses admin tidak valid atau telah kedaluwarsa.');
    error.statusCode = 401;
    error.code = 'INVALID_OR_EXPIRED_TOKEN';
    return next(error);
  }

  // Query database authoritatively for current role and session validity
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, role: true, tokenVersion: true },
  });

  if (!user || user.tokenVersion !== payload.tokenVersion) {
    const error: AppError = new Error('Sesi admin telah dicabut atau diubah. Silakan login kembali.');
    error.statusCode = 401;
    error.code = 'SESSION_REVOKED';
    return next(error);
  }

  if (user.role !== 'ADMIN') {
    const error: AppError = new Error('Akses ditolak. Tindakan ini memerlukan hak administrator.');
    error.statusCode = 403;
    error.code = 'FORBIDDEN';
    return next(error);
  }

  req.adminUser = {
    id: user.id,
    email: user.email,
    role: user.role as Role,
  };

  req.user = {
    id: user.id,
    email: user.email,
  };

  next();
}
