import { Router, Request, Response, NextFunction } from 'express';
import {
  RegisterInputSchema,
  LoginInputSchema,
  UpdateProfileInputSchema,
  ChangePasswordInputSchema,
  GoogleExchangeInputSchema,
  GoogleLinkInitInputSchema,
  COOKIE_NAMES,
} from '@studyflow/shared';
import { prisma } from '@studyflow/database';
import {
  registerUser,
  loginUser,
  rotateRefreshToken,
  logoutUser,
  getUserProfile,
  updateUserProfile,
  changeUserPassword,
} from '../services/auth.service.js';
import {
  isGoogleConfigured,
  generateGoogleAuthUrl,
  exchangeGoogleCode,
} from '../services/googleAuth.service.js';
import { verifyPassword } from '../services/password.service.js';
import { verifyAccessToken } from '../services/token.service.js';
import { setAuthCookies, clearAuthCookies } from '../services/cookie.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { authRateLimiter, loginAccountRateLimiter } from '../middleware/rateLimiter.js';
import { originCheckMiddleware } from '../middleware/originCheck.js';
import { AppError } from '../middleware/errorHandler.js';

export const authRouter = Router();

// Apply CSRF/Origin check to all state-changing endpoints in auth
authRouter.use(originCheckMiddleware);

// POST /api/auth/register
authRouter.post(
  '/register',
  authRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = RegisterInputSchema.safeParse(req.body);
      if (!parsed.success) {
        const error: AppError = new Error(parsed.error.errors[0]?.message || 'Input registrasi tidak valid');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        return next(error);
      }

      const { user } = await registerUser(parsed.data);

      res.status(201).json({
        message: 'Akun berhasil dibuat. Silakan masuk menggunakan akun barumu.',
        user,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/login
authRouter.post(
  '/login',
  authRateLimiter,
  loginAccountRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = LoginInputSchema.safeParse(req.body);
      if (!parsed.success) {
        const error: AppError = new Error('Email dan password wajib diisi dengan benar');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        return next(error);
      }

      const { user, accessToken, refreshToken } = await loginUser(parsed.data);

      setAuthCookies(res, accessToken, refreshToken);

      res.status(200).json({
        message: 'Login berhasil',
        user,
        accessToken,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/refresh
authRouter.post(
  '/refresh',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawRefreshToken = req.cookies?.[COOKIE_NAMES.refreshToken] || req.body?.refreshToken;

      if (!rawRefreshToken) {
        const error: AppError = new Error('Refresh token tidak ditemukan');
        error.statusCode = 401;
        error.code = 'REFRESH_TOKEN_REQUIRED';
        return next(error);
      }

      const { user, accessToken, refreshToken } = await rotateRefreshToken(rawRefreshToken);

      setAuthCookies(res, accessToken, refreshToken);

      res.status(200).json({
        message: 'Sesi berhasil diperbarui',
        user,
        accessToken,
      });
    } catch (err) {
      clearAuthCookies(res);
      next(err);
    }
  }
);

// POST /api/auth/logout
authRouter.post(
  '/logout',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawRefreshToken = req.cookies?.[COOKIE_NAMES.refreshToken] || req.body?.refreshToken;
      await logoutUser(rawRefreshToken);
      clearAuthCookies(res);

      res.status(200).json({
        message: 'Logout berhasil',
      });
    } catch (err) {
      clearAuthCookies(res);
      next(err);
    }
  }
);

// GET /api/auth/me
authRouter.get(
  '/me',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await getUserProfile(req.user!.id);
      res.status(200).json({ user });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/auth/me
authRouter.patch(
  '/me',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = UpdateProfileInputSchema.safeParse(req.body);
      if (!parsed.success) {
        const error: AppError = new Error(parsed.error.errors[0]?.message || 'Input update profil tidak valid');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        return next(error);
      }

      const updatedUser = await updateUserProfile(req.user!.id, parsed.data);

      res.status(200).json({
        message: 'Profil berhasil diperbarui',
        user: updatedUser,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/change-password
authRouter.post(
  '/change-password',
  authRateLimiter,
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = ChangePasswordInputSchema.safeParse(req.body);
      if (!parsed.success) {
        const error: AppError = new Error(parsed.error.errors[0]?.message || 'Input ganti password tidak valid');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        return next(error);
      }

      await changeUserPassword(req.user!.id, parsed.data);
      clearAuthCookies(res);

      res.status(200).json({
        message: 'Password berhasil diubah. Silakan masuk kembali dengan password baru.',
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/auth/google/status
authRouter.get(
  '/google/status',
  async (_req: Request, res: Response) => {
    res.status(200).json({
      configured: isGoogleConfigured(),
    });
  }
);

// GET /api/auth/google/url
authRouter.get(
  '/google/url',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const prompt = req.query.prompt === 'consent' ? 'consent' : 'select_account';
      const redirectUri = typeof req.query.redirectUri === 'string' ? req.query.redirectUri : undefined;
      const result = generateGoogleAuthUrl({ prompt, redirectUri });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/google/link/init (Requires authentication & re-auth with current password)
authRouter.post(
  '/google/link/init',
  authRateLimiter,
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = GoogleLinkInitInputSchema.safeParse(req.body);
      if (!parsed.success) {
        const error: AppError = new Error(
          parsed.error.errors[0]?.message || 'Input re-autentikasi tidak valid'
        );
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        return next(error);
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
      });

      if (!user) {
        const error: AppError = new Error('Pengguna tidak ditemukan');
        error.statusCode = 404;
        error.code = 'USER_NOT_FOUND';
        return next(error);
      }

      // Re-authenticate user via password verification if user has a password
      if (user.passwordHash) {
        const isPasswordValid = await verifyPassword(
          parsed.data.currentPassword,
          user.passwordHash
        );
        if (!isPasswordValid) {
          const error: AppError = new Error('Password saat ini tidak sesuai untuk re-autentikasi');
          error.statusCode = 400;
          error.code = 'INVALID_CURRENT_PASSWORD';
          return next(error);
        }
      }

      const authParams = generateGoogleAuthUrl({ prompt: 'select_account' });
      res.status(200).json({
        ...authParams,
        userId: user.id,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/google/exchange
authRouter.post(
  '/google/exchange',
  authRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = GoogleExchangeInputSchema.safeParse(req.body);
      if (!parsed.success) {
        const error: AppError = new Error(
          parsed.error.errors[0]?.message || 'Input pertukaran kode Google tidak valid'
        );
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        return next(error);
      }

      let currentUserId: string | undefined;

      // Extract current user if authenticated or intent is link
      const rawAccessToken =
        req.cookies?.[COOKIE_NAMES.accessToken] ||
        req.headers.authorization?.replace(/^Bearer\s+/, '');

      if (rawAccessToken) {
        const payload = verifyAccessToken(rawAccessToken);
        if (payload) {
          const user = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: { id: true, tokenVersion: true },
          });
          if (user && user.tokenVersion === payload.tokenVersion) {
            currentUserId = user.id;
          }
        }
      }

      if (parsed.data.intent === 'link' && !currentUserId) {
        const error: AppError = new Error(
          'Sesi autentikasi diperlukan untuk menghubungkan akun Google'
        );
        error.statusCode = 401;
        error.code = 'UNAUTHORIZED';
        return next(error);
      }

      const result = await exchangeGoogleCode(parsed.data, currentUserId);

      if (result.accessToken && result.refreshToken) {
        setAuthCookies(res, result.accessToken, result.refreshToken);
      }

      res.status(200).json({
        message: result.message,
        user: result.user,
        accessToken: result.accessToken,
      });
    } catch (err) {
      next(err);
    }
  }
);

