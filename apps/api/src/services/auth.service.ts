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

export function toUserProfile(
  user: {
    id: string;
    name: string;
    email: string;
    timezone: string;
    createdAt: Date | string;
    updatedAt: Date | string;
    passwordHash?: string | null;
  },
  providers: string[] = []
): UserProfile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    timezone: user.timezone,
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
    user: toUserProfile(user, user.federatedIdentities.map((f) => f.provider)),
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
      token_version: number;
      created_at: Date;
      updated_at: Date;
    }>>`
      SELECT id, name, email, password_hash, timezone, token_version, created_at, updated_at
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

    const userProfile: UserProfile = {
      id: user.id,
      name: user.name,
      email: user.email,
      timezone: user.timezone,
      createdAt: new Date(user.created_at).toISOString(),
      updatedAt: new Date(user.updated_at).toISOString(),
      hasPassword: Boolean(user.password_hash),
      providers,
    };

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
      include: {
        federatedIdentities: {
          select: { provider: true },
        },
      },
    });

    const providers = updatedUser.federatedIdentities.map((f) => f.provider);
    return toUserProfile(updatedUser, providers);
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
  });
}
