import { Router, Request, Response, NextFunction } from 'express';
import {
  AdminLoginInputSchema,
  ADMIN_COOKIE_NAMES,
} from '@studyflow/shared';
import {
  loginAdmin,
  rotateAdminRefreshToken,
  logoutAdmin,
} from '../services/admin.service.js';
import {
  setAdminAuthCookies,
  clearAdminAuthCookies,
} from '../services/cookie.service.js';
import { toUserProfile } from '../services/auth.service.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { adminLoginRateLimiter } from '../middleware/rateLimiter.js';
import { originCheckMiddleware } from '../middleware/originCheck.js';
import { prisma } from '@studyflow/database';

export const adminAuthRouter = Router();

// Apply CSRF/Origin check to all state-changing endpoints in admin auth
adminAuthRouter.use(originCheckMiddleware);

// POST /api/admin/auth/login
adminAuthRouter.post('/login', adminLoginRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = AdminLoginInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Data login tidak valid',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const { user, accessToken, refreshToken } = await loginAdmin(parseResult.data);
    setAdminAuthCookies(res, accessToken, refreshToken);

    res.status(200).json({
      message: 'Login administrator berhasil',
      user,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/auth/refresh
adminAuthRouter.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies?.[ADMIN_COOKIE_NAMES.refreshToken];

    if (!refreshToken) {
      res.status(400).json({
        error: {
          code: 'REFRESH_TOKEN_REQUIRED',
          message: 'Refresh token admin tidak ditemukan',
        },
      });
      return;
    }

    const result = await rotateAdminRefreshToken(refreshToken);
    setAdminAuthCookies(res, result.accessToken, result.refreshToken);

    res.status(200).json({
      message: 'Token admin berhasil diperbarui',
      user: result.user,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/auth/logout
adminAuthRouter.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies?.[ADMIN_COOKIE_NAMES.refreshToken];
    await logoutAdmin(refreshToken);
    clearAdminAuthCookies(res);

    res.status(200).json({
      message: 'Logout admin berhasil',
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/auth/me
adminAuthRouter.get('/me', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.adminUser!.id },
      include: {
        federatedIdentities: {
          select: { provider: true },
        },
      },
    });

    if (!user) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Pengguna tidak ditemukan',
        },
      });
      return;
    }

    res.status(200).json({
      user: toUserProfile(user, user.federatedIdentities.map((f) => f.provider)),
    });
  } catch (err) {
    next(err);
  }
});
