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

// Grace period in milliseconds to tolerate race conditions between multiple tabs
// or parallel asynchronous requests sharing the same refresh token (RFC 6819)
const REFRESH_GRACE_PERIOD_MS = 15_000;

export function toUserProfile(user: {
  id: string;
  name: string;
  email: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}): UserProfile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    timezone: user.timezone,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
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
  });

  // Generic message on failed login to not leak user existence
  if (!user) {
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
    tokenVersion: user.tokenVersion,
  });

  return {
    user: toUserProfile(user),
    accessToken,
    refreshToken: rawRefreshToken,
  };
}

export async function rotateRefreshToken(rawRefreshToken: string): Promise<{
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

  const session = await prisma.refreshSession.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session) {
    const error: AppError = new Error('Sesi tidak valid atau telah berakhir. Silakan login kembali.');
    error.statusCode = 401;
    error.code = 'SESSION_NOT_FOUND';
    throw error;
  }

  // Check if session has already been revoked
  if (session.revokedAt !== null) {
    const elapsedSinceRevoke = Date.now() - session.revokedAt.getTime();

    // Tolerant grace period: If revoked within REFRESH_GRACE_PERIOD_MS,
    // accommodate race conditions from parallel requests or multiple tabs
    if (elapsedSinceRevoke <= REFRESH_GRACE_PERIOD_MS) {
      // Find the active session in this family
      const activeSession = await prisma.refreshSession.findFirst({
        where: {
          familyId: session.familyId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      });

      if (activeSession) {
        // Return a fresh access token for the active session without revoking
        const accessToken = createAccessToken({
          userId: activeSession.user.id,
          email: activeSession.user.email,
          tokenVersion: activeSession.user.tokenVersion,
        });

        return {
          user: toUserProfile(activeSession.user),
          accessToken,
          // Intentionally omit refreshToken so the browser cookie set by the winning request is retained
        };
      }
    }

    // Token reuse / replay attack detected outside grace period:
    // Revoke the ENTIRE session family immediately!
    await prisma.refreshSession.updateMany({
      where: {
        familyId: session.familyId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    const error: AppError = new Error('Penyalahgunaan sesi terdeteksi. Seluruh sesi telah dicabut demi keamanan.');
    error.statusCode = 401;
    error.code = 'SESSION_REPLAY_DETECTED';
    throw error;
  }

  // Check if session has expired
  if (session.expiresAt < new Date()) {
    await prisma.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const error: AppError = new Error('Sesi telah kedaluwarsa. Silakan login kembali.');
    error.statusCode = 401;
    error.code = 'SESSION_EXPIRED';
    throw error;
  }

  // Atomic rotation in transaction
  const newRawRefreshToken = generateRandomToken();
  const newTokenHash = hashToken(newRawRefreshToken);
  const newExpiresAt = getRefreshTokenExpiryDate();

  await prisma.$transaction([
    prisma.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshSession.create({
      data: {
        userId: session.userId,
        familyId: session.familyId,
        tokenHash: newTokenHash,
        expiresAt: newExpiresAt,
      },
    }),
  ]);

  const accessToken = createAccessToken({
    userId: session.user.id,
    email: session.user.email,
    tokenVersion: session.user.tokenVersion,
  });

  return {
    user: toUserProfile(session.user),
    accessToken,
    refreshToken: newRawRefreshToken,
  };
}

export async function logoutUser(rawRefreshToken?: string): Promise<void> {
  if (rawRefreshToken && typeof rawRefreshToken === 'string') {
    const tokenHash = hashToken(rawRefreshToken);
    const session = await prisma.refreshSession.findUnique({
      where: { tokenHash },
    });

    if (session) {
      // Revoke the entire session family for this login session
      await prisma.refreshSession.updateMany({
        where: {
          familyId: session.familyId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }
  }
}

export async function getUserProfile(userId: string): Promise<UserProfile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    const error: AppError = new Error('Pengguna tidak ditemukan');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  return toUserProfile(user);
}

export async function updateUserProfile(
  userId: string,
  input: UpdateProfileInput
): Promise<UserProfile> {
  const updateData: { name?: string; timezone?: string } = {};

  if (input.name !== undefined) {
    updateData.name = input.name.trim();
  }
  if (input.timezone !== undefined) {
    updateData.timezone = input.timezone;
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return toUserProfile(updatedUser);
  } catch {
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

  const isCurrentValid = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!isCurrentValid) {
    const error: AppError = new Error('Password saat ini tidak sesuai');
    error.statusCode = 400;
    error.code = 'INVALID_CURRENT_PASSWORD';
    throw error;
  }

  const newPasswordHash = await hashPassword(input.newPassword);

  // Invalidate all sessions and increment tokenVersion so existing access tokens are immediately rejected
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        tokenVersion: { increment: 1 },
      },
    }),
    prisma.refreshSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    }),
  ]);
}
