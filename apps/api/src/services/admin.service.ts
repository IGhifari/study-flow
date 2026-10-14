import crypto from 'node:crypto';
import { prisma } from '@studyflow/database';
import {
  AdminLoginInput,
  AdminSummary,
  AdminUserListQuery,
  AdminUserListResponse,
  UserProfile,
  Role,
} from '@studyflow/shared';
import { verifyPassword } from './password.service.js';
import {
  createAccessToken,
  generateRandomToken,
  hashToken,
  getRefreshTokenExpiryDate,
} from './token.service.js';
import { toUserProfile, rotateRefreshToken, logoutUser } from './auth.service.js';
import { AppError } from '../middleware/errorHandler.js';

export async function loginAdmin(input: AdminLoginInput): Promise<{
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

  if (user.role !== 'ADMIN') {
    const error: AppError = new Error('Akses ditolak. Akun ini tidak memiliki hak administrator.');
    error.statusCode = 403;
    error.code = 'FORBIDDEN';
    throw error;
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

export async function rotateAdminRefreshToken(rawRefreshToken: string): Promise<{
  user: UserProfile;
  accessToken: string;
  refreshToken?: string;
}> {
  const result = await rotateRefreshToken(rawRefreshToken);
  if (result.user.role !== 'ADMIN') {
    const error: AppError = new Error('Akses ditolak. Akun ini tidak memiliki hak administrator.');
    error.statusCode = 403;
    error.code = 'FORBIDDEN';
    throw error;
  }
  return result;
}

export async function logoutAdmin(rawRefreshToken?: string): Promise<void> {
  if (rawRefreshToken) {
    await logoutUser(rawRefreshToken);
  }
}

export async function getAdminSummary(): Promise<AdminSummary> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [totalUsers, totalMaterials, totalAssignments, failedJobs24h] = await Promise.all([
    prisma.user.count(),
    prisma.material.count({ where: { deletedAt: null } }),
    prisma.assignment.count(),
    prisma.processingJob.count({
      where: {
        status: 'FAILED',
        createdAt: { gte: oneDayAgo },
      },
    }),
  ]);

  return {
    totalUsers,
    totalMaterials,
    totalAssignments,
    failedJobs24h,
    calculatedAt: new Date().toISOString(),
  };
}

export async function listAdminUsers(query: AdminUserListQuery): Promise<AdminUserListResponse> {
  const page = query.page || 1;
  const limit = query.limit || 20;
  const search = query.search?.trim();
  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder || 'desc';

  const where: any = {};
  if (search && search.length > 0) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [totalItems, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerifiedAt: true,
        createdAt: true,
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    }),
  ]);

  return {
    items: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role as Role,
      emailVerifiedAt: u.emailVerifiedAt ? u.emailVerifiedAt.toISOString() : null,
      createdAt: u.createdAt.toISOString(),
    })),
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit) || 1,
      hasNext: page * limit < totalItems,
      hasPrev: page > 1,
    },
  };
}
