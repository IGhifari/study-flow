import { Request, Response, NextFunction } from 'express';
import { Role } from '@studyflow/shared';
import { resolveAuthenticatedUser } from './authenticate.js';
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
  try {
    const user = await resolveAuthenticatedUser(req, { preferAdminCookie: true });

    if (user.role !== 'ADMIN') {
      const error: AppError = new Error('Akses ditolak. Tindakan ini memerlukan hak administrator.');
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      return next(error);
    }

    req.adminUser = user;
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (err) {
    next(err);
  }
}
