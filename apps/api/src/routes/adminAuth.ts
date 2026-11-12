import crypto from 'node:crypto';
import { Router, Request, Response, NextFunction } from 'express';
import {
  AdminLoginInputSchema,
  AdminUpdateProfileInputSchema,
  AdminChangePasswordInputSchema,
  ADMIN_COOKIE_NAMES,
  COOKIE_NAMES,
} from '@studyflow/shared';
import {
  loginAdmin,
  rotateAdminRefreshToken,
  logoutAdmin,
} from '../services/admin.service.js';
import {
  setAdminAuthCookies,
  clearAdminAuthCookies,
  setAuthCookies,
  clearAuthCookies,
} from '../services/cookie.service.js';
import { toUserProfile, changeUserPassword } from '../services/auth.service.js';
import {
  createAccessToken,
  generateRandomToken,
  hashToken,
  getRefreshTokenExpiryDate,
} from '../services/token.service.js';
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
    const adminRefresh = req.cookies?.[ADMIN_COOKIE_NAMES.refreshToken];
    const webRefresh = req.cookies?.[COOKIE_NAMES.refreshToken];
    const refreshToken = adminRefresh || webRefresh;

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
    if (adminRefresh || !webRefresh) {
      setAdminAuthCookies(res, result.accessToken, result.refreshToken);
    }
    if (webRefresh) {
      setAuthCookies(res, result.accessToken, result.refreshToken);
    }

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
    const refreshToken =
      req.cookies?.[ADMIN_COOKIE_NAMES.refreshToken] || req.cookies?.[COOKIE_NAMES.refreshToken];
    await logoutAdmin(refreshToken);
    clearAdminAuthCookies(res);
    if (req.cookies?.[COOKIE_NAMES.refreshToken] || req.cookies?.[COOKIE_NAMES.accessToken]) {
      clearAuthCookies(res);
    }

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

// PATCH /api/admin/auth/profile
adminAuthRouter.patch('/profile', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = AdminUpdateProfileInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Data pembaruan profil administrator tidak valid',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const updateData: any = {};
    if (parseResult.data.name !== undefined) {
      updateData.name = parseResult.data.name.trim();
    }
    if (parseResult.data.timezone !== undefined) {
      updateData.timezone = parseResult.data.timezone;
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.adminUser!.id },
      data: updateData,
      include: {
        federatedIdentities: {
          select: { provider: true },
        },
      },
    });

    res.status(200).json({
      message: 'Profil administrator berhasil diperbarui',
      user: toUserProfile(updatedUser, updatedUser.federatedIdentities.map((f) => f.provider)),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/auth/change-password
adminAuthRouter.post('/change-password', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = AdminChangePasswordInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Data perubahan kata sandi tidak valid',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
      return;
    }

    // Call changeUserPassword which validates current password, sets new Argon2id hash,
    // increments tokenVersion, and revokes all active refresh sessions
    await changeUserPassword(req.adminUser!.id, parseResult.data);

    // Immediately establish a fresh refresh session & access token for the admin
    // so current session stays alive while all other devices/sessions are invalidated
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.adminUser!.id },
    });

    const familyId = crypto.randomUUID();
    const rawRefreshToken = generateRandomToken();
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = getRefreshTokenExpiryDate();

    await prisma.refreshSession.create({
      data: {
        userId: user.id,
        familyId,
        tokenHash,
        expiresAt,
      },
    });

    const accessToken = createAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    });

    setAdminAuthCookies(res, accessToken, rawRefreshToken);
    if (req.cookies?.[COOKIE_NAMES.accessToken] || req.cookies?.[COOKIE_NAMES.refreshToken]) {
      setAuthCookies(res, accessToken, rawRefreshToken);
    }

    res.status(200).json({
      message: 'Kata sandi berhasil diperbarui. Sesi perangkat lain telah dicabut.',
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/auth/sessions
adminAuthRouter.get('/sessions', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentRawRefreshToken =
      req.cookies?.[ADMIN_COOKIE_NAMES.refreshToken] || req.cookies?.[COOKIE_NAMES.refreshToken];
    const currentTokenHash = currentRawRefreshToken ? hashToken(currentRawRefreshToken) : null;

    const sessions = await prisma.refreshSession.findMany({
      where: {
        userId: req.adminUser!.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    const items = sessions.map((session) => ({
      id: session.id,
      familyId: session.familyId,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      isCurrent: currentTokenHash ? session.tokenHash === currentTokenHash : false,
    }));

    res.setHeader('Cache-Control', 'no-store, private');
    res.status(200).json({
      sessions: items,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/auth/sessions/:id
adminAuthRouter.delete('/sessions/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.id;
    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim().length === 0) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'ID sesi tidak valid',
        },
      });
      return;
    }

    const session = await prisma.refreshSession.findFirst({
      where: {
        id: sessionId.trim(),
        userId: req.adminUser!.id,
      },
    });

    if (!session) {
      res.status(404).json({
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Sesi login tidak ditemukan',
        },
      });
      return;
    }

    await prisma.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    res.status(200).json({
      message: 'Sesi login berhasil dicabut',
    });
  } catch (err) {
    next(err);
  }
});
