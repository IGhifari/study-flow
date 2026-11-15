import { Router, Request, Response, NextFunction } from 'express';
import {
  RegisterInputSchema,
  LoginInputSchema,
  UpdateProfileInputSchema,
  ChangePasswordInputSchema,
  GoogleExchangeInputSchema,
  GoogleLinkInitInputSchema,
  ForgotPasswordInputSchema,
  ResetPasswordInputSchema,
  VerifyEmailInputSchema,
  COOKIE_NAMES,
  ADMIN_COOKIE_NAMES,
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
  requestPasswordReset,
  resetPasswordWithToken,
  requestEmailVerification,
  verifyEmailWithToken,
} from '../services/auth.service.js';
import {
  isGoogleConfigured,
  generateGoogleAuthUrl,
  exchangeGoogleCode,
} from '../services/googleAuth.service.js';
import { verifyTurnstileToken } from '../services/turnstile.service.js';
import {
  isCaptchaRequiredForLogin,
  recordLoginFailure,
  resetAccountLoginFailures,
} from '../services/loginProtection.service.js';
import { verifyPassword } from '../services/password.service.js';
import { verifyAccessToken } from '../services/token.service.js';
import {
  setAuthCookies,
  clearAuthCookies,
  clearAdminAuthCookies,
} from '../services/cookie.service.js';
import { authenticate } from '../middleware/authenticate.js';
import {
  authRateLimiter,
  loginAccountRateLimiter,
  forgotPasswordIpRateLimiter,
  forgotPasswordAccountRateLimiter,
  verificationEmailRateLimiter,
} from '../middleware/rateLimiter.js';
import { originCheckMiddleware } from '../middleware/originCheck.js';
import { AppError } from '../middleware/errorHandler.js';
import { env } from '../config/env.js';

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
        const error: AppError = new Error(parsed.error.issues[0]?.message || 'Input registrasi tidak valid');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        return next(error);
      }

      // Turnstile is strictly required in production, in development when TURNSTILE_SECRET_KEY is set,
      // or in test when TEST_ENFORCE_TURNSTILE is active
      const isTurnstileEnforced =
        env.NODE_ENV === 'production'
          ? true
          : env.NODE_ENV !== 'test'
          ? Boolean(env.TURNSTILE_SECRET_KEY)
          : process.env.TEST_ENFORCE_TURNSTILE === 'true';

      if (isTurnstileEnforced && (!parsed.data.turnstileToken || parsed.data.turnstileToken.trim().length === 0)) {
        const error: AppError = new Error('Verifikasi keamanan Turnstile wajib diisi');
        error.statusCode = 400;
        error.code = 'TURNSTILE_TOKEN_REQUIRED';
        return next(error);
      }

      if (parsed.data.turnstileToken) {
        await verifyTurnstileToken({
          token: parsed.data.turnstileToken,
          remoteIp: req.ip,
          expectedAction: 'register',
        });
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

      // Adaptive CAPTCHA: Turnstile is only required after repeated failures
      // (per account hash OR per IP). Enforced in production, in development when
      // TURNSTILE_SECRET_KEY is set, or in test when TEST_ENFORCE_TURNSTILE is active.
      const isTurnstileEnforced =
        env.NODE_ENV === 'production'
          ? true
          : env.NODE_ENV !== 'test'
          ? Boolean(env.TURNSTILE_SECRET_KEY)
          : process.env.TEST_ENFORCE_TURNSTILE === 'true';

      const captchaRequired =
        isTurnstileEnforced && (await isCaptchaRequiredForLogin(parsed.data.email, req.ip));

      if (captchaRequired) {
        if (!parsed.data.turnstileToken || parsed.data.turnstileToken.trim().length === 0) {
          const error: AppError = new Error('Verifikasi keamanan diperlukan. Selesaikan verifikasi lalu coba lagi.');
          error.statusCode = 400;
          error.code = 'TURNSTILE_TOKEN_REQUIRED';
          error.details = { requireCaptcha: true };
          return next(error);
        }

        try {
          await verifyTurnstileToken({
            token: parsed.data.turnstileToken,
            remoteIp: req.ip,
            expectedAction: 'login',
          });
        } catch (turnstileErr) {
          if (turnstileErr instanceof Error) {
            (turnstileErr as AppError).details = { requireCaptcha: true };
          }
          throw turnstileErr;
        }
      }

      let loginResult: Awaited<ReturnType<typeof loginUser>>;
      try {
        loginResult = await loginUser(parsed.data);
      } catch (loginErr) {
        const appErr = loginErr as AppError;
        if (isTurnstileEnforced && appErr instanceof Error && appErr.statusCode === 401) {
          // Counted identically for registered/unregistered emails (no account enumeration)
          const nowRequired = await recordLoginFailure(parsed.data.email, req.ip);
          appErr.details = { requireCaptcha: nowRequired };
        }
        throw loginErr;
      }

      await resetAccountLoginFailures(parsed.data.email);

      const { user, accessToken, refreshToken } = loginResult;
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
      if (
        req.cookies?.[ADMIN_COOKIE_NAMES.accessToken] ||
        req.cookies?.[ADMIN_COOKIE_NAMES.refreshToken]
      ) {
        clearAdminAuthCookies(res);
      }
      next(err);
    }
  }
);

// POST /api/auth/logout
authRouter.post(
  '/logout',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const webRefreshToken =
        req.cookies?.[COOKIE_NAMES.refreshToken] || req.body?.refreshToken;
      const adminRefreshToken = req.cookies?.[ADMIN_COOKIE_NAMES.refreshToken];

      await logoutUser(webRefreshToken);
      if (adminRefreshToken && adminRefreshToken !== webRefreshToken) {
        await logoutUser(adminRefreshToken);
      }

      clearAuthCookies(res);
      clearAdminAuthCookies(res);

      res.status(200).json({
        message: 'Logout berhasil',
      });
    } catch (err) {
      clearAuthCookies(res);
      clearAdminAuthCookies(res);
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
        const error: AppError = new Error(parsed.error.issues[0]?.message || 'Input update profil tidak valid');
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
        const error: AppError = new Error(parsed.error.issues[0]?.message || 'Input ganti password tidak valid');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        return next(error);
      }

      await changeUserPassword(req.user!.id, parsed.data);
      clearAuthCookies(res);
      clearAdminAuthCookies(res);

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
          parsed.error.issues[0]?.message || 'Input re-autentikasi tidak valid'
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
          parsed.error.issues[0]?.message || 'Input pertukaran kode Google tidak valid'
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

// POST /api/auth/forgot-password
authRouter.post(
  '/forgot-password',
  forgotPasswordIpRateLimiter,
  forgotPasswordAccountRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = ForgotPasswordInputSchema.safeParse(req.body);
      if (!parsed.success) {
        const error: AppError = new Error(
          parsed.error.issues[0]?.message || 'Alamat email wajib diisi dengan format yang benar'
        );
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        return next(error);
      }

      // Turnstile is strictly required in production, in development when TURNSTILE_SECRET_KEY is set,
      // or in test when TEST_ENFORCE_TURNSTILE is active
      const isTurnstileEnforced =
        env.NODE_ENV === 'production'
          ? true
          : env.NODE_ENV !== 'test'
          ? Boolean(env.TURNSTILE_SECRET_KEY)
          : process.env.TEST_ENFORCE_TURNSTILE === 'true';

      if (isTurnstileEnforced && (!parsed.data.turnstileToken || parsed.data.turnstileToken.trim().length === 0)) {
        const error: AppError = new Error('Verifikasi keamanan Turnstile wajib diisi');
        error.statusCode = 400;
        error.code = 'TURNSTILE_TOKEN_REQUIRED';
        return next(error);
      }

      if (parsed.data.turnstileToken) {
        await verifyTurnstileToken({
          token: parsed.data.turnstileToken,
          remoteIp: req.ip,
          expectedAction: 'forgot_password',
        });
      }

      const result = await requestPasswordReset(parsed.data.email);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/reset-password
authRouter.post(
  '/reset-password',
  authRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = ResetPasswordInputSchema.safeParse(req.body);
      if (!parsed.success) {
        const error: AppError = new Error(
          parsed.error.issues[0]?.message || 'Input reset password tidak valid'
        );
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        return next(error);
      }

      const result = await resetPasswordWithToken(parsed.data.token, parsed.data.newPassword);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/verify-email/request (Pengguna login meminta email verifikasi)
authRouter.post(
  '/verify-email/request',
  authRateLimiter,
  verificationEmailRateLimiter,
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await requestEmailVerification(req.user!.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/verify-email/confirm (Konsumsi token verifikasi email)
authRouter.post(
  '/verify-email/confirm',
  authRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = VerifyEmailInputSchema.safeParse(req.body);
      if (!parsed.success) {
        const error: AppError = new Error(
          parsed.error.issues[0]?.message || 'Input verifikasi email tidak valid'
        );
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        return next(error);
      }

      const result = await verifyEmailWithToken(parsed.data.token);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);



