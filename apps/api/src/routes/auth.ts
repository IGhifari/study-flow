import { Router, Request, Response, NextFunction } from 'express';
import {
  RegisterInputSchema,
  LoginInputSchema,
  UpdateProfileInputSchema,
  ChangePasswordInputSchema,
  COOKIE_NAMES,
} from '@studyflow/shared';
import {
  registerUser,
  loginUser,
  rotateRefreshToken,
  logoutUser,
  getUserProfile,
  updateUserProfile,
  changeUserPassword,
} from '../services/auth.service.js';
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
