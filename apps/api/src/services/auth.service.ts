import crypto from 'node:crypto';
import { prisma, Prisma } from '@studyflow/database';
import {
  RegisterInput,
  LoginInput,
  UpdateProfileInput,
  ChangePasswordInput,
  UserProfile,
} from '@studyflow/shared';
import { hashPassword, verifyPassword, needsRehash } from './password.service.js';
import {
  createAccessToken,
  generateRandomToken,
  hashToken,
  getRefreshTokenExpiryDate,
} from './token.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { env } from '../config/env.js';
import { sendPasswordResetEmail, sendVerificationEmail } from './email.service.js';

// Grace period in milliseconds to tolerate race conditions between multiple tabs
// or parallel asynchronous requests sharing the same refresh token (RFC 6819)
const REFRESH_GRACE_PERIOD_MS = 15_000;

export function toUserProfile(
  user: {
    id: string;
    name: string;
    email: string;
    timezone: string;
    role?: 'USER' | 'ADMIN';
    emailVerifiedAt?: Date | string | null;
    reminderEmailDeadline?: boolean;
    createdAt: Date | string;
    updatedAt: Date | string;
    passwordHash?: string | null;
  },
  providers: string[] = []
): UserProfile {
  let emailVerifiedAtStr: string | null = null;
  if (user.emailVerifiedAt) {
    emailVerifiedAtStr =
      typeof user.emailVerifiedAt === 'string'
        ? user.emailVerifiedAt
        : user.emailVerifiedAt.toISOString();
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    timezone: user.timezone,
    role: user.role ?? 'USER',
    emailVerifiedAt: emailVerifiedAtStr,
    reminderEmailDeadline: Boolean(user.reminderEmailDeadline),
    createdAt: typeof user.createdAt === 'string' ? user.createdAt : user.createdAt.toISOString(),
    updatedAt: typeof user.updatedAt === 'string' ? user.updatedAt : user.updatedAt.toISOString(),
    hasPassword: Boolean(user.passwordHash),
    providers,
  };
}

export async function registerUser(input: RegisterInput): Promise<{ user: UserProfile }> {
  const normalizedEmail = input.email.toLowerCase().trim();

  // Pre-check for existing user
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    const error: AppError = new Error('Email sudah terdaftar. Silakan masuk menggunakan email tersebut.');
    error.statusCode = 409;
    error.code = 'EMAIL_ALREADY_EXISTS';
    throw error;
  }

  const passwordHash = await hashPassword(input.password);

  try {
    const newUser = await prisma.user.create({
      data: {
        name: input.name.trim(),
        email: normalizedEmail,
        passwordHash,
        timezone: input.timezone || 'Asia/Jakarta',
      },
    });

    return {
      user: toUserProfile(newUser),
    };
  } catch (err) {
    // Handle concurrent duplicate insertion
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const error: AppError = new Error('Email sudah terdaftar. Silakan masuk menggunakan email tersebut.');
      error.statusCode = 409;
      error.code = 'EMAIL_ALREADY_EXISTS';
      throw error;
    }
    throw err;
  }
}

export async function loginUser(input: LoginInput): Promise<{
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
}> {
  const normalizedEmail = input.email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      federatedIdentities: {
        select: { provider: true },
      },
    },
  });

  // Generic message on failed login to not leak user existence or authentication method
  if (!user || !user.passwordHash) {
    const error: AppError = new Error('Email atau password tidak sesuai');
    error.statusCode = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }

  const isPasswordValid = await verifyPassword(input.password, user.passwordHash);
  if (!isPasswordValid) {
    const error: AppError = new Error('Email atau password tidak sesuai');
    error.statusCode = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }

  // Strict separation: Reject ADMIN users from logging into the student web portal
  if (user.role === 'ADMIN') {
    const error: AppError = new Error(
      'Akun administrator tidak diizinkan masuk ke portal mahasiswa. Silakan masuk melalui portal administrator.'
    );
    error.statusCode = 403;
    error.code = 'ADMIN_PORTAL_ONLY';
    throw error;
  }

  // Transparently upgrade legacy bcrypt hash to modern Argon2id hash on successful login
  if (needsRehash(user.passwordHash)) {
    try {
      const upgradedHash = await hashPassword(input.password);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: upgradedHash },
      });
    } catch {
      // Non-fatal if rehash write fails during login read
    }
  }

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

  return {
    user: toUserProfile(user, user.federatedIdentities.map((f) => f.provider)),
    accessToken,
    refreshToken: rawRefreshToken,
  };
}

export async function rotateRefreshToken(
  rawRefreshToken: string,
  options?: { allowAdmin?: boolean }
): Promise<{
  user: UserProfile;
  accessToken: string;
  refreshToken?: string;
}> {
  if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
    const error: AppError = new Error('Refresh token diperlukan');
    error.statusCode = 400;
    error.code = 'INVALID_TOKEN';
    throw error;
  }

  const tokenHash = hashToken(rawRefreshToken);

  // Preliminary unlocked lookup to find the userId associated with the tokenHash
  const initialSession = await prisma.refreshSession.findUnique({
    where: { tokenHash },
    select: { userId: true },
  });

  if (!initialSession) {
    const error: AppError = new Error('Sesi tidak valid atau telah berakhir. Silakan login kembali.');
    error.statusCode = 401;
    error.code = 'SESSION_NOT_FOUND';
    throw error;
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Lock the USER row first (consistent order: users -> refresh_sessions)
    const lockedUsers = await tx.$queryRaw<Array<{
      id: string;
      name: string;
      email: string;
      password_hash: string | null;
      timezone: string;
      role: 'USER' | 'ADMIN';
      email_verified_at: Date | null;
      reminder_email_deadline: boolean;
      token_version: number;
      created_at: Date;
      updated_at: Date;
    }>>`
      SELECT id, name, email, password_hash, timezone, role, email_verified_at, reminder_email_deadline, token_version, created_at, updated_at
      FROM users
      WHERE id = ${initialSession.userId}
      LIMIT 1
      FOR UPDATE
    `;

    const user = lockedUsers[0];

    if (!user) {
      const error: AppError = new Error('Pengguna tidak ditemukan');
      error.statusCode = 404;
      error.code = 'USER_NOT_FOUND';
      throw error;
    }

    // Strict separation: Reject ADMIN users from rotating student web sessions
    if (user.role === 'ADMIN' && !options?.allowAdmin) {
      const error: AppError = new Error(
        'Akun administrator tidak diizinkan masuk ke portal mahasiswa. Sesi mahasiswa telah dicabut.'
      );
      error.statusCode = 403;
      error.code = 'ADMIN_PORTAL_ONLY';
      throw error;
    }

    // 2. Lock the specific SESSION row second (users -> refresh_sessions)
    const lockedSessions = await tx.$queryRaw<Array<{
      id: string;
      user_id: string;
      token_hash: string;
      family_id: string;
      expires_at: Date;
      revoked_at: Date | null;
    }>>`
      SELECT id, user_id, token_hash, family_id, expires_at, revoked_at
      FROM refresh_sessions
      WHERE token_hash = ${tokenHash}
      LIMIT 1
      FOR UPDATE
    `;

    const session = lockedSessions[0];

    if (!session) {
      const error: AppError = new Error('Sesi tidak valid atau telah berakhir. Silakan login kembali.');
      error.statusCode = 401;
      error.code = 'SESSION_NOT_FOUND';
      throw error;
    }

    const federatedIdentities = await tx.federatedIdentity.findMany({
      where: { userId: user.id },
      select: { provider: true },
    });
    const providers = federatedIdentities.map((f) => f.provider);

    const userProfile = toUserProfile({
      id: user.id,
      name: user.name,
      email: user.email,
      timezone: user.timezone,
      role: user.role,
      emailVerifiedAt: user.email_verified_at,
      reminderEmailDeadline: user.reminder_email_deadline,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      passwordHash: user.password_hash,
    }, providers);

    const now = new Date();

    // 3. Check if session has already been revoked (checked under lock!)
    if (session.revoked_at !== null) {
      const elapsedSinceRevoke = now.getTime() - new Date(session.revoked_at).getTime();

      // Grace period: If revoked within REFRESH_GRACE_PERIOD_MS,
      // allow parallel requests from other tabs/clients to receive a fresh access token
      // WITHOUT creating duplicate child sessions or branching the family.
      // NOTE: If the session was revoked due to password change or logout, activeSession will be null!
      if (elapsedSinceRevoke <= REFRESH_GRACE_PERIOD_MS) {
        // Find the active (non-revoked) session in this family
        const activeSession = await tx.refreshSession.findFirst({
          where: {
            familyId: session.family_id,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          orderBy: { createdAt: 'desc' },
        });

        if (activeSession) {
          const accessToken = createAccessToken({
            userId: user.id,
            email: user.email,
            role: user.role,
            tokenVersion: user.token_version,
          });

          return {
            user: userProfile,
            accessToken,
            // Intentionally omit refreshToken so the browser retains the winning cookie
          };
        }
      }

      // Replay attack detected outside grace period (or family already completely revoked):
      // Revoke the ENTIRE session family immediately!
      await tx.refreshSession.updateMany({
        where: {
          familyId: session.family_id,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      });

      return {
        replayDetected: true,
      };
    }

    // 4. Check if session has expired
    if (new Date(session.expires_at) < now) {
      await tx.refreshSession.update({
        where: { id: session.id },
        data: { revokedAt: now },
      });

      return {
        expired: true,
      };
    }

    // 5. Normal rotation: revoke current session and create exactly one child session
    const newRawRefreshToken = generateRandomToken();
    const newTokenHash = hashToken(newRawRefreshToken);
    const newExpiresAt = getRefreshTokenExpiryDate();

    await tx.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: now },
    });

    await tx.refreshSession.create({
      data: {
        userId: session.user_id,
        familyId: session.family_id,
        tokenHash: newTokenHash,
        expiresAt: newExpiresAt,
      },
    });

    const accessToken = createAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.token_version,
    });

    return {
      user: userProfile,
      accessToken,
      refreshToken: newRawRefreshToken,
    };
  });

  if ('replayDetected' in result && result.replayDetected) {
    const error: AppError = new Error('Penyalahgunaan sesi terdeteksi. Seluruh sesi telah dicabut demi keamanan.');
    error.statusCode = 401;
    error.code = 'SESSION_REPLAY_DETECTED';
    throw error;
  }

  if ('expired' in result && result.expired) {
    const error: AppError = new Error('Sesi telah kedaluwarsa. Silakan login kembali.');
    error.statusCode = 401;
    error.code = 'SESSION_EXPIRED';
    throw error;
  }

  return result as {
    user: UserProfile;
    accessToken: string;
    refreshToken?: string;
  };
}

export async function logoutUser(rawRefreshToken?: string): Promise<void> {
  if (rawRefreshToken && typeof rawRefreshToken === 'string') {
    const tokenHash = hashToken(rawRefreshToken);

    const initialSession = await prisma.refreshSession.findUnique({
      where: { tokenHash },
      select: { userId: true, familyId: true },
    });

    if (initialSession) {
      await prisma.$transaction(async (tx) => {
        // 1. Lock the user row first (consistent order: users -> refresh_sessions)
        await tx.$queryRaw`
          SELECT id FROM users
          WHERE id = ${initialSession.userId}
          LIMIT 1
          FOR UPDATE
        `;

        // 2. Revoke the entire session family for this login session
        await tx.refreshSession.updateMany({
          where: {
            familyId: initialSession.familyId,
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
          },
        });
      });
    }
  }
}

export async function getUserProfile(userId: string): Promise<UserProfile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      federatedIdentities: {
        select: { provider: true },
      },
    },
  });

  if (!user) {
    const error: AppError = new Error('Pengguna tidak ditemukan');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  const providers = user.federatedIdentities.map((f) => f.provider);
  return toUserProfile(user, providers);
}

export async function updateUserProfile(
  userId: string,
  input: UpdateProfileInput
): Promise<UserProfile> {
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, emailVerifiedAt: true },
  });

  if (!currentUser) {
    const error: AppError = new Error('Pengguna tidak ditemukan');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  const updateData: { name?: string; timezone?: string; reminderEmailDeadline?: boolean } = {};

  if (input.name !== undefined) {
    updateData.name = input.name.trim();
  }
  if (input.timezone !== undefined) {
    updateData.timezone = input.timezone;
  }
  if (input.reminderEmailDeadline !== undefined) {
    if (input.reminderEmailDeadline === true && !currentUser.emailVerifiedAt) {
      const error: AppError = new Error(
        'Alamat email harus diverifikasi terlebih dahulu sebelum mengaktifkan pengingat deadline'
      );
      error.statusCode = 400;
      error.code = 'EMAIL_NOT_VERIFIED';
      throw error;
    }
    updateData.reminderEmailDeadline = input.reminderEmailDeadline;
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        federatedIdentities: {
          select: { provider: true },
        },
      },
    });

    const providers = updatedUser.federatedIdentities.map((f) => f.provider);
    return toUserProfile(updatedUser, providers);
  } catch (err: any) {
    if (err?.statusCode || err?.code) throw err;
    const error: AppError = new Error('Gagal memperbarui profil pengguna');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }
}

export async function changeUserPassword(
  userId: string,
  input: ChangePasswordInput
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    const error: AppError = new Error('Pengguna tidak ditemukan');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  if (!user.passwordHash) {
    const error: AppError = new Error('Akun ini terdaftar melalui Google dan belum memiliki password lokal.');
    error.statusCode = 400;
    error.code = 'PASSWORD_NOT_SET';
    throw error;
  }

  const isCurrentValid = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!isCurrentValid) {
    const error: AppError = new Error('Password saat ini tidak sesuai');
    error.statusCode = 400;
    error.code = 'INVALID_CURRENT_PASSWORD';
    throw error;
  }

  const newPasswordHash = await hashPassword(input.newPassword);

  // Invalidate all sessions and increment tokenVersion so existing access tokens are immediately rejected
  await prisma.$transaction(async (tx) => {
    // 1. Lock the user row to serialize with concurrent rotateRefreshToken
    await tx.$queryRaw`
      SELECT id FROM users
      WHERE id = ${userId}
      LIMIT 1
      FOR UPDATE
    `;

    // 2. Increment tokenVersion and set new password hash
    await tx.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        tokenVersion: { increment: 1 },
      },
    });

    // 3. Revoke all currently active refresh sessions for this user
    await tx.refreshSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    // 4. Invalidate all active password reset tokens for this user
    await tx.passwordResetToken.updateMany({
      where: {
        userId,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });
  });
}

const GENERIC_FORGOT_PASSWORD_MESSAGE =
  'Jika akun memenuhi syarat, tautan reset password akan dikirim ke email tersebut.';

export async function requestPasswordReset(rawEmail: string): Promise<{ message: string }> {
  const normalizedEmail = (rawEmail || '').toLowerCase().trim();

  // Find user with federatedIdentities
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { federatedIdentities: true },
  });

  // If user does not exist or user has no local password (Google-only user):
  // Perform dummy password hashing to prevent timing attacks that reveal user existence / auth method.
  if (!user || !user.passwordHash) {
    await hashPassword('studyflow-dummy-mitigate-timing-attack-salt-padding-string-123');
    return { message: GENERIC_FORGOT_PASSWORD_MESSAGE };
  }

  // Cooldown check: Check if an active reset token was generated less than 60 seconds ago
  const now = new Date();
  const recentToken = await prisma.passwordResetToken.findFirst({
    where: {
      userId: user.id,
      usedAt: null,
      expiresAt: { gt: now },
      createdAt: { gt: new Date(now.getTime() - 60_000) },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (recentToken) {
    // Within cooldown: Return generic message without generating duplicate token or spamming emails
    return { message: GENERIC_FORGOT_PASSWORD_MESSAGE };
  }

  // Generate 32-byte cryptographically secure random token (64 hex characters)
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(now.getTime() + 30 * 60_000); // 30 minutes validity

  // Invalidate previous active reset tokens and create the new one in a transaction
  await prisma.$transaction(async (tx) => {
    // Lock the user row to serialize concurrent reset requests
    await tx.$queryRaw`
      SELECT id FROM users
      WHERE id = ${user.id}
      LIMIT 1
      FOR UPDATE
    `;

    // Cancel previous unconsumed reset tokens
    await tx.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: {
        usedAt: now,
      },
    });

    // Create new reset token
    await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });
  });

  // Construct absolute reset URL from configured APP_PUBLIC_URL (never from Host header!)
  const resetUrl = `${env.APP_PUBLIC_URL}/reset-password?token=${rawToken}`;

  try {
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
      expiresInMinutes: 30,
    });
  } catch (err: unknown) {
    // Log error safely without leaking recipient email, token, or secret
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[AUTH_SERVICE] Gagal mengirimkan email reset password ke penyedia email: ${errMsg}`);
  }

  return { message: GENERIC_FORGOT_PASSWORD_MESSAGE };
}

export async function resetPasswordWithToken(
  rawToken: string,
  newPassword: string
): Promise<{ message: string }> {
  if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length < 32) {
    const error: AppError = new Error(
      'Tautan reset password tidak valid atau telah kedaluwarsa. Silakan minta tautan baru.'
    );
    error.statusCode = 400;
    error.code = 'TOKEN_INVALID_OR_EXPIRED';
    throw error;
  }

  const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
  const now = new Date();

  // Find initial token
  const initialToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!initialToken || initialToken.usedAt !== null || initialToken.expiresAt < now) {
    const error: AppError = new Error(
      'Tautan reset password tidak valid atau telah kedaluwarsa. Silakan minta tautan baru.'
    );
    error.statusCode = 400;
    error.code = 'TOKEN_INVALID_OR_EXPIRED';
    throw error;
  }

  const newPasswordHash = await hashPassword(newPassword);

  // Atomic transaction following lock order: users -> password_reset_tokens / refresh_sessions
  await prisma.$transaction(async (tx) => {
    // 1. Lock user row first to serialize concurrent requests (e.g. parallel token consumption or session rotation)
    await tx.$queryRaw`
      SELECT id FROM users
      WHERE id = ${initialToken.userId}
      LIMIT 1
      FOR UPDATE
    `;

    // 2. Re-check token under lock to guarantee exactly one request succeeds among concurrent attempts
    const lockedToken = await tx.passwordResetToken.findUnique({
      where: { id: initialToken.id },
    });

    if (!lockedToken || lockedToken.usedAt !== null || lockedToken.expiresAt < new Date()) {
      const error: AppError = new Error(
        'Tautan reset password tidak valid atau telah kedaluwarsa. Silakan minta tautan baru.'
      );
      error.statusCode = 400;
      error.code = 'TOKEN_INVALID_OR_EXPIRED';
      throw error;
    }

    // 3. Mark current token as used
    await tx.passwordResetToken.update({
      where: { id: lockedToken.id },
      data: { usedAt: new Date() },
    });

    // 4. Invalidate all other active reset tokens for this user
    await tx.passwordResetToken.updateMany({
      where: {
        userId: lockedToken.userId,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    // 5. Update passwordHash and increment tokenVersion (invalidates existing access tokens immediately)
    await tx.user.update({
      where: { id: lockedToken.userId },
      data: {
        passwordHash: newPasswordHash,
        tokenVersion: { increment: 1 },
      },
    });

    // 6. Revoke all active refresh sessions
    await tx.refreshSession.updateMany({
      where: {
        userId: lockedToken.userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  });

  return { message: 'Kata sandi berhasil diatur ulang. Silakan masuk dengan kata sandi baru Anda.' };
}

const VERIFICATION_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
const VERIFICATION_COOLDOWN_MS = 60 * 1000; // 60 seconds cooldown between dispatches

export async function requestEmailVerification(userId: string): Promise<{ message: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerifiedAt: true,
    },
  });

  if (!user) {
    const error: AppError = new Error('Pengguna tidak ditemukan');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  // Already verified accounts do not need another email
  if (user.emailVerifiedAt !== null) {
    return { message: 'Alamat email Anda sudah terverifikasi.' };
  }

  const now = new Date();

  // Enforce server-side cooldown per user: check if a token was issued within 60s
  const recentToken = await prisma.emailVerificationToken.findFirst({
    where: {
      userId: user.id,
      createdAt: { gt: new Date(now.getTime() - VERIFICATION_COOLDOWN_MS) },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (recentToken) {
    const error: AppError = new Error(
      'Permintaan verifikasi email terlalu sering. Silakan tunggu 1 menit sebelum meminta kembali.'
    );
    error.statusCode = 429;
    error.code = 'VERIFICATION_COOLDOWN_ACTIVE';
    throw error;
  }

  // Generate cryptographic token (at least 32 bytes)
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(now.getTime() + VERIFICATION_TOKEN_TTL_MS);

  // Invalidate previous active verification tokens for this user atomically
  await prisma.$transaction(async (tx) => {
    await tx.emailVerificationToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: {
        usedAt: now,
      },
    });

    await tx.emailVerificationToken.create({
      data: {
        userId: user.id,
        email: user.email,
        tokenHash,
        expiresAt,
      },
    });
  });

  // Construct absolute verification URL from configured APP_PUBLIC_URL (never from Host header!)
  const verificationUrl = `${env.APP_PUBLIC_URL}/verify-email?token=${rawToken}`;

  try {
    await sendVerificationEmail({
      to: user.email,
      name: user.name,
      verificationUrl,
      expiresInMinutes: 30,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[AUTH_SERVICE] Gagal mengirimkan email verifikasi: ${errMsg}`);
    const error: AppError = new Error('Gagal mengirimkan email verifikasi. Silakan coba lagi nanti.');
    error.statusCode = 503;
    error.code = 'EMAIL_SEND_FAILED';
    throw error;
  }

  return { message: 'Email verifikasi telah dikirim. Silakan periksa kotak masuk atau spam Anda.' };
}

export async function verifyEmailWithToken(rawToken: string): Promise<{ message: string; user: UserProfile }> {
  if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length < 32) {
    const error: AppError = new Error(
      'Tautan verifikasi email tidak valid atau telah kedaluwarsa. Silakan minta tautan baru.'
    );
    error.statusCode = 400;
    error.code = 'TOKEN_INVALID_OR_EXPIRED';
    throw error;
  }

  const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
  const now = new Date();

  // Initial check
  const initialToken = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          federatedIdentities: { select: { provider: true } },
        },
      },
    },
  });

  if (!initialToken || initialToken.usedAt !== null || initialToken.expiresAt < now) {
    const error: AppError = new Error(
      'Tautan verifikasi email tidak valid atau telah kedaluwarsa. Silakan minta tautan baru.'
    );
    error.statusCode = 400;
    error.code = 'TOKEN_INVALID_OR_EXPIRED';
    throw error;
  }

  // Ensure current user email matches token bound email
  if (initialToken.user.email.toLowerCase().trim() !== initialToken.email.toLowerCase().trim()) {
    const error: AppError = new Error(
      'Alamat email pada token tidak cocok dengan alamat email akun saat ini.'
    );
    error.statusCode = 400;
    error.code = 'EMAIL_MISMATCH';
    throw error;
  }

  // Atomic transaction following lock order: users -> email_verification_tokens
  const updatedUser = await prisma.$transaction(async (tx) => {
    // 1. Lock user row first to serialize concurrent requests
    await tx.$queryRaw`
      SELECT id FROM users
      WHERE id = ${initialToken.userId}
      LIMIT 1
      FOR UPDATE
    `;

    // 2. Re-check token under lock to guarantee exactly one request succeeds among concurrent attempts
    const lockedToken = await tx.emailVerificationToken.findUnique({
      where: { id: initialToken.id },
    });

    if (!lockedToken || lockedToken.usedAt !== null || lockedToken.expiresAt < new Date()) {
      const error: AppError = new Error(
        'Tautan verifikasi email tidak valid atau telah kedaluwarsa. Silakan minta tautan baru.'
      );
      error.statusCode = 400;
      error.code = 'TOKEN_INVALID_OR_EXPIRED';
      throw error;
    }

    // 3. Mark current token as used
    await tx.emailVerificationToken.update({
      where: { id: lockedToken.id },
      data: { usedAt: new Date() },
    });

    // 4. Invalidate all other active verification tokens for this user
    await tx.emailVerificationToken.updateMany({
      where: {
        userId: lockedToken.userId,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    // 5. Update user emailVerifiedAt atomically
    const user = await tx.user.update({
      where: { id: lockedToken.userId },
      data: {
        emailVerifiedAt: new Date(),
      },
      include: {
        federatedIdentities: { select: { provider: true } },
      },
    });

    return user;
  });

  const providers = updatedUser.federatedIdentities.map((f) => f.provider);
  return {
    message: 'Alamat email berhasil diverifikasi.',
    user: toUserProfile(updatedUser, providers),
  };
}
