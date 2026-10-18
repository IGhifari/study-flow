import crypto from 'node:crypto';
import { prisma } from '@studyflow/database';
import type {
  AdminLoginInput,
  AdminSummary,
  AdminUserListQuery,
  AdminUserListResponse,
  AdminUserDetail,
  AdminCreateUserInput,
  AdminUpdateUserInput,
  AdminUpdateMaterialInput,
  AdminCleanupJobsInput,
  AdminJobListQuery,
  AdminJobListResponse,
  AdminJobDetail,
  AdminJobType,
  AdminJobStatus,
  AdminQueueStatus,
  AdminQueueSummaryItem,
  AdminQueuesSummaryResponse,
  AdminTrendRange,
  AdminTrendsResponse,
  AdminTrendDataPoint,
  AdminModuleStatus,
  AdminSystemModule,
  AdminSystemStatusResponse,
  AdminCourseListQuery,
  AdminCourseListResponse,
  AdminMaterialListQuery,
  AdminMaterialListResponse,
  AdminMaterialStatus,
  AdminAssignmentListQuery,
  AdminAssignmentListResponse,
  AdminNoteListQuery,
  AdminNoteListResponse,
  AdminScheduleListQuery,
  AdminScheduleListResponse,
  AdminQuizListQuery,
  AdminQuizListResponse,
  UserProfile,
  Role,
} from '@studyflow/shared';
import { QUEUE_NAMES, AI_QUOTA_LIMITS } from '@studyflow/shared';
import { env } from '../config/env.js';
import { getStorageAdapter, StorageUnavailableAdapter } from './storage.service.js';
import {
  getDocumentProcessingQueue,
  getAiGenerationQueue,
  dispatchOutboxEvents,
} from './outbox.service.js';
import { verifyPassword, hashPassword } from './password.service.js';
import {
  createAccessToken,
  generateRandomToken,
  hashToken,
  getRefreshTokenExpiryDate,
} from './token.service.js';
import { toUserProfile, rotateRefreshToken, logoutUser } from './auth.service.js';
import { retryMaterialProcessing, deleteMaterial } from './material.service.js';
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
    role: user.role,
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
  const result = await rotateRefreshToken(rawRefreshToken, { allowAdmin: true });
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

  const [
    totalUsers,
    totalMaterials,
    totalAssignments,
    failedJobs24h,
    totalAdmins,
    totalCourses,
    storageAggregate,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.material.count({ where: { deletedAt: null } }),
    prisma.assignment.count(),
    prisma.processingJob.count({
      where: {
        status: 'FAILED',
        createdAt: { gte: oneDayAgo },
      },
    }),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.course.count(),
    prisma.storageUsage.aggregate({
      _sum: { usedBytes: true },
    }),
  ]);

  const totalStorageBytes = storageAggregate._sum.usedBytes
    ? Number(storageAggregate._sum.usedBytes)
    : 0;

  return {
    totalUsers,
    totalMaterials,
    totalAssignments,
    failedJobs24h,
    calculatedAt: new Date().toISOString(),
    totalAdmins,
    totalCourses,
    totalStorageBytes,
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

  if (query.role) {
    where.role = query.role;
  }

  if (query.verified === 'true') {
    where.emailVerifiedAt = { not: null };
  } else if (query.verified === 'false') {
    where.emailVerifiedAt = null;
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

function formatStorageBytes(bytes: bigint | number): string {
  const num = typeof bytes === 'bigint' ? Number(bytes) : bytes;
  if (num === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(num) / Math.log(k));
  const val = parseFloat((num / Math.pow(k, i)).toFixed(1));
  return `${val} ${sizes[i]}`;
}

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetail> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      timezone: true,
      emailVerifiedAt: true,
      createdAt: true,
      passwordHash: true,
      federatedIdentities: {
        select: {
          provider: true,
        },
      },
    },
  });

  if (!user) {
    const error: AppError = new Error('Pengguna tidak ditemukan');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  // Efficient aggregate queries in parallel
  const [
    semesters,
    courses,
    materials,
    assignments,
    notes,
    storageRecord,
    aiUsageRecord,
    activeJobsCount,
    activeSessionsCount,
  ] = await Promise.all([
    prisma.semester.count({ where: { userId } }),
    prisma.course.count({ where: { userId } }),
    prisma.material.count({ where: { userId, deletedAt: null } }),
    prisma.assignment.count({ where: { userId } }),
    prisma.note.count({ where: { userId } }),
    prisma.storageUsage.findUnique({
      where: { userId },
      select: { usedBytes: true },
    }),
    prisma.aiUsage.findUnique({
      where: { userId },
      select: { dailyGenerationCount: true, activeJobsCount: true },
    }),
    prisma.processingJob.count({
      where: {
        userId,
        status: { in: ['PENDING', 'PROCESSING'] },
      },
    }),
    prisma.refreshSession.count({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    }),
  ]);

  const hasPassword = Boolean(user.passwordHash);
  const hasGoogle = user.federatedIdentities.some((f) => f.provider === 'google');
  const methods: ('password' | 'google')[] = [];
  if (hasPassword) methods.push('password');
  if (hasGoogle) methods.push('google');

  let storageUsage = null;
  if (storageRecord) {
    const usedBytesNum = Number(storageRecord.usedBytes);
    storageUsage = {
      usedBytes: usedBytesNum,
      formatted: formatStorageBytes(storageRecord.usedBytes),
    };
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as Role,
    timezone: user.timezone,
    emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    authMethods: {
      hasPassword,
      hasGoogle,
      methods,
    },
    usageSummary: {
      semesters,
      courses,
      materials,
      assignments,
      notes,
      storageUsage,
      aiQuota: {
        dailyGenerationCount: aiUsageRecord?.dailyGenerationCount ?? 0,
        dailyLimit: AI_QUOTA_LIMITS.dailyGenerations,
        activeJobsCount: Math.max(activeJobsCount, aiUsageRecord?.activeJobsCount ?? 0),
      },
      activeSessionsCount,
    },
  };
}

export async function createAdminUser(input: AdminCreateUserInput): Promise<{
  id: string;
  name: string;
  email: string;
  role: Role;
}> {
  const normalizedEmail = input.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    const error: AppError = new Error('Email sudah terdaftar. Silakan gunakan email lain.');
    error.statusCode = 409;
    error.code = 'EMAIL_ALREADY_EXISTS';
    throw error;
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      name: input.name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: input.role,
      timezone: input.timezone || 'Asia/Jakarta',
      emailVerifiedAt: input.emailVerified ? new Date() : null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as Role,
  };
}

export async function updateAdminUser(
  actorAdminId: string,
  targetUserId: string,
  input: AdminUpdateUserInput
): Promise<AdminUserDetail> {
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  });
  if (!targetUser) {
    const error: AppError = new Error('Pengguna tidak ditemukan');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  // Guard Anti-Lockout: Demoting self is strictly rejected
  if (actorAdminId === targetUserId && input.role === 'USER') {
    const error: AppError = new Error('Anda tidak dapat menurunkan peran administrator akun Anda sendiri.');
    error.statusCode = 400;
    error.code = 'CANNOT_DEMOTE_SELF';
    throw error;
  }

  let normalizedEmail: string | undefined;
  if (input.email && input.email.toLowerCase().trim() !== targetUser.email.toLowerCase().trim()) {
    normalizedEmail = input.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      const error: AppError = new Error('Email sudah digunakan oleh akun lain');
      error.statusCode = 409;
      error.code = 'EMAIL_ALREADY_EXISTS';
      throw error;
    }
  }

  await prisma.$transaction(async (tx) => {
    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name.trim();
    if (normalizedEmail) updateData.email = normalizedEmail;
    if (input.role !== undefined) updateData.role = input.role;
    if (input.timezone !== undefined) updateData.timezone = input.timezone;

    if (input.emailVerified !== undefined) {
      if (input.emailVerified) {
        updateData.emailVerifiedAt = targetUser.emailVerifiedAt ?? new Date();
      } else {
        updateData.emailVerifiedAt = null;
      }
    }

    if (input.newPassword) {
      updateData.passwordHash = await hashPassword(input.newPassword);
      updateData.tokenVersion = { increment: 1 };
    } else if (input.revokeSessions) {
      updateData.tokenVersion = { increment: 1 };
    }

    await tx.user.update({
      where: { id: targetUserId },
      data: updateData,
    });

    if (input.newPassword || input.revokeSessions) {
      await tx.refreshSession.updateMany({
        where: {
          userId: targetUserId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }

    if (input.resetQuota) {
      await tx.aiUsage.upsert({
        where: { userId: targetUserId },
        update: {
          dailyGenerationCount: 0,
          activeJobsCount: 0,
        },
        create: {
          userId: targetUserId,
          dailyGenerationCount: 0,
          activeJobsCount: 0,
          lastResetUtc: new Date(),
        },
      });

      const todayUtcStr = new Date().toISOString().slice(0, 10);
      await tx.dailyUploadCounter.updateMany({
        where: {
          userId: targetUserId,
          uploadDate: todayUtcStr,
        },
        data: {
          uploadCount: 0,
        },
      });
    }
  });

  return getAdminUserDetail(targetUserId);
}

export async function deleteAdminUser(actorAdminId: string, targetUserId: string): Promise<void> {
  // Guard Anti-Self-Delete
  if (actorAdminId === targetUserId) {
    const error: AppError = new Error('Anda tidak dapat menghapus akun administrator yang sedang Anda gunakan.');
    error.statusCode = 400;
    error.code = 'CANNOT_DELETE_SELF';
    throw error;
  }

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
  });
  if (!user) {
    const error: AppError = new Error('Pengguna tidak ditemukan');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  await prisma.$transaction(async (tx) => {
    // Delete all child and referenced entities in dependency order
    await tx.quizAttempt.deleteMany({ where: { userId: targetUserId } });
    await tx.quiz.deleteMany({ where: { userId: targetUserId } });
    await tx.flashcardSet.deleteMany({ where: { userId: targetUserId } });
    await tx.materialSummary.deleteMany({ where: { userId: targetUserId } });
    await tx.materialPage.deleteMany({ where: { material: { userId: targetUserId } } });
    await tx.pinnedItem.deleteMany({ where: { userId: targetUserId } });
    await tx.assignmentReminderLog.deleteMany({ where: { userId: targetUserId } });
    await tx.assignmentSubtask.deleteMany({ where: { assignment: { userId: targetUserId } } });
    await tx.assignment.deleteMany({ where: { userId: targetUserId } });
    await tx.note.deleteMany({ where: { userId: targetUserId } });
    await tx.processingJob.deleteMany({ where: { userId: targetUserId } });
    await tx.material.deleteMany({ where: { userId: targetUserId } });
    await tx.courseSchedule.deleteMany({ where: { userId: targetUserId } });
    await tx.course.deleteMany({ where: { userId: targetUserId } });
    await tx.semester.deleteMany({ where: { userId: targetUserId } });
    await tx.storageUsage.deleteMany({ where: { userId: targetUserId } });
    await tx.dailyUploadCounter.deleteMany({ where: { userId: targetUserId } });
    await tx.aiUsage.deleteMany({ where: { userId: targetUserId } });
    await tx.refreshSession.deleteMany({ where: { userId: targetUserId } });
    await tx.passwordResetToken.deleteMany({ where: { userId: targetUserId } });
    await tx.emailVerificationToken.deleteMany({ where: { userId: targetUserId } });
    await tx.federatedIdentity.deleteMany({ where: { userId: targetUserId } });
    await tx.user.delete({ where: { id: targetUserId } });
  });
}

export function formatSafeErrorMessage(errorCode: string | null): string | null {
  if (!errorCode) return null;
  const errorMap: Record<string, string> = {
    // Legacy mapping
    PDF_ENCRYPTED: 'Dokumen PDF terkunci dengan kata sandi.',
    PDF_CORRUPT: 'Format berkas PDF rusak atau tidak dapat dibaca.',
    PDF_EMPTY: 'Berkas PDF tidak memuat halaman yang dapat diekstraksi.',
    PAGE_LIMIT_EXCEEDED: 'Jumlah halaman dokumen melebihi batas yang diizinkan.',
    FILE_TOO_LARGE: 'Ukuran berkas melebihi kuota penyimpanan.',
    MATERIAL_DELETED: 'Materi terkait telah dihapus oleh pengguna sebelum atau selama proses.',
    STORAGE_DOWNLOAD_FAILED: 'Gagal mengunduh berkas materi dari penyimpanan cloud.',
    EXTRACTION_TIMEOUT: 'Waktu ekstraksi teks dokumen melampaui batas waktu (timeout).',
    AI_TIMEOUT: 'Pemanggilan model AI melebihi batas waktu (timeout).',
    AI_RATE_LIMIT_EXCEEDED: 'Batas frekuensi permintaan AI terlampaui (rate limit).',
    AI_PROVIDER_UNAVAILABLE: 'Layanan penyedia AI sedang tidak dapat dihubungi.',
    AI_AUTH_FAILED: 'Autentikasi kredensial ke penyedia AI gagal.',
    AI_SERVER_ERROR: 'Terjadi kesalahan internal pada server penyedia AI.',
    AI_REQUEST_FAILED: 'Permintaan pemrosesan AI ditolak oleh penyedia layanan.',
    AI_SAFETY_BLOCKED: 'Konten dokumen terblokir oleh filter keamanan penyedia AI.',
    AI_EMPTY_RESPONSE: 'Model AI memberikan respon kosong.',
    AI_INVALID_OUTPUT: 'Keluaran dari model AI tidak memenuhi skema yang diharapkan.',
    AI_INVALID_JSON: 'Format JSON keluaran model AI tidak valid.',
    AI_OUTPUT_TRUNCATED: 'Keluaran AI terpotong karena mencapai batas token maksimum.',
    DOCUMENT_TOO_LARGE: 'Dokumen terlalu panjang untuk diproses oleh model AI.',
    QUOTA_EXCEEDED: 'Kuota harian pembuatan konten AI pengguna telah tercapai.',

    // Worker & API error codes
    FILE_ENCRYPTED: 'Dokumen PDF terkunci dengan kata sandi.',
    FILE_CORRUPTED: 'Format berkas PDF rusak atau tidak dapat dibaca.',
    INVALID_FILE_SIGNATURE: 'Header berkas tidak valid atau bukan dokumen PDF standar.',
    SCANNED_PDF_NO_TEXT: 'Berkas PDF hasil pindaian (scan) tidak memiliki lapisan teks yang dapat diekstraksi.',
    EXCEEDS_PAGE_LIMIT: 'Jumlah halaman dokumen melebihi batas maksimum (100 halaman).',
    PARSING_TIMEOUT: 'Waktu ekstraksi teks dokumen melampaui batas waktu (timeout).',
    EXTRACTION_FAILED: 'Gagal mengekstraksi teks dari dokumen PDF.',
    MATERIAL_NOT_READY: 'Materi belum selesai diekstraksi sehingga belum siap diproses AI.',
    INSUFFICIENT_TEXT: 'Teks dokumen terlalu pendek atau tidak memadai untuk diproses AI.',
    UPLOAD_ABANDONED: 'Unggahan berkas tidak diselesaikan oleh pengguna hingga melewati batas waktu.',
    MANUALLY_RELEASED: 'Slot pekerjaan AI dilepaskan karena melewati batas waktu pemrosesan.',
    DAILY_QUOTA_EXHAUSTED: 'Kuota harian penyedia layanan AI telah habis.',
    AI_DAILY_QUOTA_EXCEEDED: 'Kuota harian pembuatan konten AI pengguna telah tercapai.',
    AI_CONCURRENT_LIMIT_EXCEEDED: 'Batas pekerjaan AI paralel pengguna sedang penuh.',
    AI_NETWORK_ERROR: 'Gagal terhubung ke jaringan penyedia layanan AI.',
    AI_JOB_CALL_LIMIT_EXCEEDED: 'Pekerjaan melampaui batas maksimum panggilan ke penyedia AI.',
    AI_REDIS_UNAVAILABLE: 'Layanan antrean dan pembatas laju AI (Redis) sedang tidak tersedia.',
    AI_INVALID_RESPONSE: 'Format respons dari penyedia layanan AI tidak dapat dibaca.',
    AI_GENERATION_FAILED: 'Gagal menghasilkan konten pembelajaran AI.',
  };
  return errorMap[errorCode] || 'Terjadi kesalahan operasional saat memproses pekerjaan.';
}

export function calculateDurationMs(
  startedAt: Date | null,
  completedAt: Date | null,
  failedAt: Date | null
): number | null {
  if (!startedAt) return null;
  const finishedAt = completedAt || failedAt;
  if (!finishedAt) return null;
  const diff = finishedAt.getTime() - startedAt.getTime();
  return diff >= 0 ? diff : null;
}

export async function listAdminJobs(query: AdminJobListQuery): Promise<AdminJobListResponse> {
  const page = query.page || 1;
  const limit = query.limit || 20;
  const { type, status, userId, jobId, search, startDate, endDate, sortBy = 'createdAt', sortOrder = 'desc' } = query;

  if (startDate && endDate) {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    if (start > end) {
      const error: AppError = new Error('Rentang tanggal tidak valid: startDate harus lebih awal dari endDate');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
    const maxRangeMs = 90 * 24 * 60 * 60 * 1000; // 90 days max
    if (end - start > maxRangeMs) {
      const error: AppError = new Error('Rentang tanggal pencarian maksimal adalah 90 hari');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
  }

  const where: any = {};
  if (type) where.type = type;
  if (status) where.status = status;
  if (userId) where.userId = userId;
  if (jobId) where.id = jobId;

  const trimmedSearch = search?.trim();
  if (trimmedSearch) {
    where.OR = [
      { id: { contains: trimmedSearch, mode: 'insensitive' } },
      { userId: { contains: trimmedSearch, mode: 'insensitive' } },
      { user: { name: { contains: trimmedSearch, mode: 'insensitive' } } },
    ];
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const [totalItems, jobs] = await Promise.all([
    prisma.processingJob.count({ where }),
    prisma.processingJob.findMany({
      where,
      select: {
        id: true,
        type: true,
        status: true,
        userId: true,
        materialId: true,
        attempts: true,
        maxAttempts: true,
        errorCode: true,
        startedAt: true,
        completedAt: true,
        failedAt: true,
        createdAt: true,
        user: {
          select: {
            name: true,
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    }),
  ]);

  return {
    items: jobs.map((job) => ({
      id: job.id,
      type: job.type as AdminJobType,
      status: job.status as AdminJobStatus,
      userId: job.userId,
      userName: job.user?.name || 'Pengguna Tidak Dikenal',
      materialId: job.materialId,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      errorCode: job.errorCode,
      safeErrorMessage: formatSafeErrorMessage(job.errorCode),
      durationMs: calculateDurationMs(job.startedAt, job.completedAt, job.failedAt),
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt ? job.startedAt.toISOString() : null,
      completedAt: job.completedAt ? job.completedAt.toISOString() : null,
      failedAt: job.failedAt ? job.failedAt.toISOString() : null,
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

export async function getAdminJobDetail(jobId: string): Promise<AdminJobDetail> {
  const job = await prisma.processingJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      type: true,
      status: true,
      userId: true,
      materialId: true,
      attempts: true,
      maxAttempts: true,
      errorCode: true,
      startedAt: true,
      completedAt: true,
      failedAt: true,
      createdAt: true,
      user: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!job) {
    const error: AppError = new Error('Pekerjaan tidak ditemukan');
    error.statusCode = 404;
    error.code = 'JOB_NOT_FOUND';
    throw error;
  }

  let queueStatus: AdminQueueStatus = 'unavailable';
  let queueName: string | null = null;

  try {
    const isDoc = job.type === 'DOCUMENT_EXTRACTION' || job.type === 'DOCUMENT_CLEANUP';
    const queue = isDoc ? getDocumentProcessingQueue() : getAiGenerationQueue();
    queueName = queue.name;

    const bullJob = await Promise.race([
      queue.getJob(jobId),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Queue timeout')), 2000)),
    ]);

    if (bullJob) {
      const state = await bullJob.getState();
      if (['waiting', 'active', 'delayed', 'completed', 'failed'].includes(state)) {
        queueStatus = state as AdminQueueStatus;
      } else {
        queueStatus = 'active';
      }
    } else {
      queueStatus = 'not_found';
    }
  } catch {
    queueStatus = 'unavailable';
  }

  return {
    id: job.id,
    type: job.type as AdminJobType,
    status: job.status as AdminJobStatus,
    queueStatus,
    queueName,
    userId: job.userId,
    userName: job.user?.name || 'Pengguna Tidak Dikenal',
    materialId: job.materialId,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    errorCode: job.errorCode,
    safeErrorMessage: formatSafeErrorMessage(job.errorCode),
    durationMs: calculateDurationMs(job.startedAt, job.completedAt, job.failedAt),
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt ? job.startedAt.toISOString() : null,
    completedAt: job.completedAt ? job.completedAt.toISOString() : null,
    failedAt: job.failedAt ? job.failedAt.toISOString() : null,
  };
}

export async function getAdminQueuesSummary(): Promise<AdminQueuesSummaryResponse> {
  const queuesConfig = [
    {
      name: QUEUE_NAMES.documentProcessing,
      label: 'Pemrosesan Dokumen',
      getQueue: getDocumentProcessingQueue,
      retentionNote: 'Menyimpan hingga 100 job sukses dan 200 job gagal terbaru.',
    },
    {
      name: QUEUE_NAMES.aiGeneration,
      label: 'Generasi AI (Ringkasan, Flashcard, Kuis)',
      getQueue: getAiGenerationQueue,
      retentionNote: 'Menyimpan hingga 100 job sukses dan 200 job gagal terbaru.',
    },
  ];

  let anyConnected = false;
  const queuesSummary: AdminQueueSummaryItem[] = [];

  for (const cfg of queuesConfig) {
    try {
      const q = cfg.getQueue();
      const counts = await Promise.race([
        q.getJobCounts('waiting', 'active', 'delayed', 'failed'),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 2000)),
      ]);

      anyConnected = true;
      queuesSummary.push({
        name: cfg.name,
        label: cfg.label,
        status: 'available',
        counts: {
          waiting: counts.waiting || 0,
          active: counts.active || 0,
          delayed: counts.delayed || 0,
          failed: counts.failed || 0,
        },
        retentionNote: cfg.retentionNote,
      });
    } catch {
      queuesSummary.push({
        name: cfg.name,
        label: cfg.label,
        status: 'unavailable',
        counts: null,
        retentionNote: cfg.retentionNote,
      });
    }
  }

  return {
    queues: queuesSummary,
    redisStatus: anyConnected ? 'connected' : 'unavailable',
    retentionNotice:
      'Angka antrean mencerminkan kondisi memori saat ini pada BullMQ Redis dan dibatasi oleh kebijakan retensi. Gunakan riwayat database untuk data jangka panjang yang permanen.',
    timestamp: new Date().toISOString(),
  };
}

export async function getAdminTrends(range: AdminTrendRange = '30d'): Promise<AdminTrendsResponse> {
  const daysMap: Record<AdminTrendRange, number> = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
  };
  const days = daysMap[range] ?? 30;

  const now = new Date();
  const startDate = new Date(now);
  startDate.setUTCDate(startDate.getUTCDate() - (days - 1));
  startDate.setUTCHours(0, 0, 0, 0);

  // Prepopulate dateMap to ensure all dates are present in chronological order
  const dateMap = new Map<string, { materi: number; tugas: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setUTCDate(startDate.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    dateMap.set(key, { materi: 0, tugas: 0 });
  }

  type TrendAggregationRow = {
    date: string;
    count: number | bigint;
  };

  const [materialRows, assignmentRows] = await Promise.all([
    prisma.$queryRaw<TrendAggregationRow[]>`
      SELECT TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date, COUNT(*)::int AS count
      FROM materials
      WHERE created_at >= ${startDate} AND deleted_at IS NULL
      GROUP BY TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
    `,
    prisma.$queryRaw<TrendAggregationRow[]>`
      SELECT TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date, COUNT(*)::int AS count
      FROM assignments
      WHERE created_at >= ${startDate}
      GROUP BY TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
    `,
  ]);

  let totalMateri = 0;
  for (const m of materialRows) {
    const item = dateMap.get(m.date);
    const count = Number(m.count);
    if (item) {
      item.materi = count;
    }
    totalMateri += count;
  }

  let totalTugas = 0;
  for (const a of assignmentRows) {
    const item = dateMap.get(a.date);
    const count = Number(a.count);
    if (item) {
      item.tugas = count;
    }
    totalTugas += count;
  }

  const data: AdminTrendDataPoint[] = Array.from(dateMap.entries()).map(([date, counts]) => ({
    date,
    materi: counts.materi,
    tugas: counts.tugas,
  }));

  return {
    range,
    startDate: startDate.toISOString(),
    endDate: now.toISOString(),
    data,
    totals: {
      materi: totalMateri,
      tugas: totalTugas,
    },
  };
}

export async function getAdminSystemStatus(): Promise<AdminSystemStatusResponse> {
  const now = new Date().toISOString();
  const modules: AdminSystemModule[] = [];

  // 1. PostgreSQL Database
  let dbStatus: AdminModuleStatus = 'HEALTHY';
  let dbLatencyMs = 0;
  let dbDescription = 'Koneksi basis data PostgreSQL aktif dan merespons query dengan normal.';
  try {
    const t0 = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - t0;
    if (dbLatencyMs > 1000) {
      dbStatus = 'DEGRADED';
      dbDescription = 'Latensi basis data PostgreSQL tinggi (> 1000ms).';
    }
  } catch {
    dbStatus = 'UNAVAILABLE';
    dbDescription = 'Basis data PostgreSQL tidak dapat diakses atau menolak koneksi.';
  }

  modules.push({
    id: 'postgres-db',
    name: 'Basis Data PostgreSQL & Prisma ORM',
    category: 'DATABASE',
    status: dbStatus,
    engine: 'PostgreSQL / Prisma',
    metricLabel: 'Latensi Query',
    metricValue: dbStatus === 'HEALTHY' || dbStatus === 'DEGRADED' ? `${dbLatencyMs} ms` : 'Tidak tersedia',
    description: dbDescription,
    updatedAt: now,
  });

  // 2. Redis & Queues
  const queuesSummary = await getAdminQueuesSummary();
  const redisHealthy = queuesSummary.redisStatus === 'connected';

  modules.push({
    id: 'redis-broker',
    name: 'Redis In-Memory Broker',
    category: 'QUEUE_WORKER',
    status: redisHealthy ? 'HEALTHY' : 'UNAVAILABLE',
    engine: 'Redis BullMQ',
    metricLabel: 'Koneksi Broker',
    metricValue: redisHealthy ? 'Terhubung' : 'Terputus',
    description: redisHealthy
      ? 'Koneksi ke broker Redis aktif untuk manajemen antrean background job.'
      : 'Broker Redis tidak dapat dihubungi. Antrean background job tidak beroperasi.',
    updatedAt: now,
  });

  // Document Processing Worker / Queue
  const docQueue = queuesSummary.queues.find((q) => q.name.includes('document'));
  const docAvailable = docQueue?.status === 'available';
  const docCounts = docQueue?.counts;
  const docActiveTotal = (docCounts?.waiting ?? 0) + (docCounts?.active ?? 0);
  const docFailedTotal = docCounts?.failed ?? 0;

  let docStatus: AdminModuleStatus = 'HEALTHY';
  if (!redisHealthy || !docAvailable) {
    docStatus = 'UNAVAILABLE';
  } else if (docFailedTotal > 20 || docActiveTotal > 100) {
    docStatus = 'DEGRADED';
  }

  modules.push({
    id: 'worker-document',
    name: 'Worker Pemrosesan Dokumen',
    category: 'QUEUE_WORKER',
    status: docStatus,
    engine: 'BullMQ Worker',
    metricLabel: 'Antrean Dokumen',
    metricValue: docAvailable && docCounts ? `${docActiveTotal} aktif / waiting (${docFailedTotal} gagal)` : 'Tidak tersedia',
    description: 'Menangani ekstraksi teks PDF perkuliahan, pemrosesan halaman, dan pembersihan file sementara.',
    updatedAt: now,
    details: docCounts ? { ...docCounts } : undefined,
  });

  // AI Generation Worker / Queue
  const aiQueue = queuesSummary.queues.find((q) => q.name.includes('ai'));
  const aiAvailable = aiQueue?.status === 'available';
  const aiCounts = aiQueue?.counts;
  const aiActiveTotal = (aiCounts?.waiting ?? 0) + (aiCounts?.active ?? 0);
  const aiFailedTotal = aiCounts?.failed ?? 0;

  let aiQueueStatus: AdminModuleStatus = 'HEALTHY';
  if (!redisHealthy || !aiAvailable) {
    aiQueueStatus = 'UNAVAILABLE';
  } else if (aiFailedTotal > 20 || aiActiveTotal > 100) {
    aiQueueStatus = 'DEGRADED';
  }

  modules.push({
    id: 'worker-ai',
    name: 'Worker Generasi AI (Ringkasan, Flashcard, Kuis)',
    category: 'QUEUE_WORKER',
    status: aiQueueStatus,
    engine: 'BullMQ AI Worker',
    metricLabel: 'Antrean AI',
    metricValue: aiAvailable && aiCounts ? `${aiActiveTotal} aktif / waiting (${aiFailedTotal} gagal)` : 'Tidak tersedia',
    description: 'Menjalankan pipeline pembuatan materi ringkasan, kartu belajar flashcard, dan kuis akademik.',
    updatedAt: now,
    details: aiCounts ? { ...aiCounts } : undefined,
  });

  // 3. Storage
  const storageAdapter = getStorageAdapter();
  const isStorageUnavailable = storageAdapter instanceof StorageUnavailableAdapter;
  const storageDriver = env.STORAGE_DRIVER;
  let storageStatus: AdminModuleStatus = 'HEALTHY';
  let storageMetric = 'Aktif (Signed URL)';
  let storageDesc = `Penyimpanan berkas aktif menggunakan driver ${storageDriver}.`;

  if (isStorageUnavailable || storageDriver === 'none') {
    storageStatus = 'UNCONFIGURED';
    storageMetric = 'Belum Dikonfigurasi';
    storageDesc = 'Layanan penyimpanan berkas materi belum dikonfigurasi.';
  } else if (storageDriver === 'local') {
    storageStatus = 'HEALTHY';
    storageMetric = 'Local Disk Driver';
    storageDesc = 'Penyimpanan berkas materi berjalan pada filesystem lokal sistem.';
  } else if (storageDriver === 'supabase') {
    storageStatus = 'HEALTHY';
    storageMetric = 'Supabase S3 Bucket';
    storageDesc = 'Penyimpanan materi privat tersimpan aman pada bucket Supabase Storage.';
  }

  modules.push({
    id: 'storage-service',
    name: 'Penyimpanan Berkas Materi (Object Storage)',
    category: 'STORAGE',
    status: storageStatus,
    engine: `Storage Driver: ${storageDriver}`,
    metricLabel: 'Status Driver',
    metricValue: storageMetric,
    description: storageDesc,
    updatedAt: now,
  });

  // 4. AI Engine (Gemini / Mock)
  const aiProvider = env.AI_PROVIDER;
  const isAiConfigured = aiProvider === 'mock' || Boolean(env.GEMINI_API_KEY);
  let aiStatus: AdminModuleStatus = 'HEALTHY';
  let aiMetric = `${env.GEMINI_MODEL}`;
  let aiDesc = `Pipeline AI menggunakan model ${env.GEMINI_MODEL}. Kuota harian diproteksi transaksi atomik Postgres.`;

  if (!isAiConfigured && aiProvider === 'gemini') {
    aiStatus = 'UNCONFIGURED';
    aiMetric = 'API Key Kosong';
    aiDesc = 'GEMINI_API_KEY belum dikonfigurasi di environment server.';
  } else if (aiProvider === 'none') {
    aiStatus = 'UNAVAILABLE';
    aiMetric = 'Dinonaktifkan';
    aiDesc = 'Fitur AI generasi dinonaktifkan pada konfigurasi server.';
  } else if (aiProvider === 'mock') {
    aiMetric = 'Mock Deterministic AI';
    aiDesc = 'Pipeline AI berjalan dalam mode mock deterministik (pengujian/development).';
  }

  modules.push({
    id: 'ai-pipeline',
    name: 'Pipeline Generasi AI & Kuota Atomik',
    category: 'AI_PIPELINE',
    status: aiStatus,
    engine: `Provider: ${aiProvider}`,
    metricLabel: 'Model / Status',
    metricValue: aiMetric,
    description: aiDesc,
    updatedAt: now,
  });

  // 5. Autentikasi & Security
  modules.push({
    id: 'security-auth',
    name: 'Autentikasi & Isolasi Sesi Admin',
    category: 'SECURITY',
    status: 'HEALTHY',
    engine: 'Express JWT & HttpOnly Cookie',
    metricLabel: 'Isolasi Sesi',
    metricValue: 'Role DB Enforced',
    description: 'Pemisahan sesi admin dan mahasiswa dengan verifikasi peran berbasis database pada setiap request.',
    updatedAt: now,
  });

  return {
    modules,
    timestamp: now,
  };
}

export async function listAdminCourses(
  query: AdminCourseListQuery
): Promise<AdminCourseListResponse> {
  const { page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'desc' } = query;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
      { lecturer: { contains: search, mode: 'insensitive' } },
      { user: { name: { contains: search, mode: 'insensitive' } } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [totalItems, courses] = await Promise.all([
    prisma.course.count({ where }),
    prisma.course.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        semester: { select: { name: true, academicYear: true } },
        user: { select: { id: true, name: true, email: true } },
        _count: {
          select: { materials: true, assignments: true },
        },
      },
    }),
  ]);

  const totalPages = Math.ceil(totalItems / limit) || 1;

  return {
    items: courses.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      lecturer: c.lecturer,
      semesterName: c.semester?.name || '-',
      academicYear: c.semester?.academicYear || '-',
      userId: c.user.id,
      userName: c.user.name,
      userEmail: c.user.email,
      materialsCount: c._count.materials,
      assignmentsCount: c._count.assignments,
      createdAt: c.createdAt.toISOString(),
    })),
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

export async function listAdminMaterials(
  query: AdminMaterialListQuery
): Promise<AdminMaterialListResponse> {
  const { page = 1, limit = 20, search, status, userId, sortBy = 'createdAt', sortOrder = 'desc' } = query;
  const skip = (page - 1) * limit;

  const where: any = { deletedAt: null };
  if (status) {
    where.status = status;
  }
  if (userId) {
    where.userId = userId;
  }
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { originalFilename: { contains: search, mode: 'insensitive' } },
      { course: { name: { contains: search, mode: 'insensitive' } } },
      { user: { name: { contains: search, mode: 'insensitive' } } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [totalItems, materials] = await Promise.all([
    prisma.material.count({ where }),
    prisma.material.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        course: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  const totalPages = Math.ceil(totalItems / limit) || 1;

  return {
    items: materials.map((m) => ({
      id: m.id,
      title: m.title,
      originalFilename: m.originalFilename,
      mimeType: m.mimeType,
      bytes: m.bytes,
      formattedSize: formatStorageBytes(m.bytes),
      pageCount: m.pageCount,
      status: m.status as AdminMaterialStatus,
      errorCode: m.errorCode,
      safeErrorMessage: formatSafeErrorMessage(m.errorCode),
      userId: m.user.id,
      userName: m.user.name,
      userEmail: m.user.email,
      courseId: m.course.id,
      courseName: m.course.name,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    })),
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

export async function updateAdminMaterial(
  materialId: string,
  input: AdminUpdateMaterialInput
): Promise<{ message: string; materialId: string }> {
  const material = await prisma.material.findFirst({
    where: { id: materialId, deletedAt: null },
  });
  if (!material) {
    const error: AppError = new Error('Materi tidak ditemukan');
    error.statusCode = 404;
    error.code = 'MATERIAL_NOT_FOUND';
    throw error;
  }

  if (input.title) {
    await prisma.material.update({
      where: { id: materialId },
      data: { title: input.title },
    });
  }

  if (input.action === 'retry') {
    if (material.status !== 'FAILED') {
      const error: AppError = new Error('Hanya materi dengan status FAILED yang dapat diproses ulang.');
      error.statusCode = 400;
      error.code = 'MATERIAL_NOT_FAILED';
      throw error;
    }
    await retryMaterialProcessing(material.userId, material.id);
  }

  return {
    message: 'Materi berhasil diperbarui',
    materialId,
  };
}

export async function deleteAdminMaterial(materialId: string): Promise<void> {
  const material = await prisma.material.findFirst({
    where: { id: materialId, deletedAt: null },
  });
  if (!material) {
    const error: AppError = new Error('Materi tidak ditemukan');
    error.statusCode = 404;
    error.code = 'MATERIAL_NOT_FOUND';
    throw error;
  }

  await deleteMaterial(material.userId, material.id);
}

export async function retryAdminJob(jobId: string): Promise<{ message: string; jobId: string }> {
  const job = await prisma.processingJob.findUnique({
    where: { id: jobId },
  });
  if (!job) {
    const error: AppError = new Error('Pekerjaan tidak ditemukan');
    error.statusCode = 404;
    error.code = 'JOB_NOT_FOUND';
    throw error;
  }

  if (job.status !== 'FAILED') {
    const error: AppError = new Error('Hanya pekerjaan dengan status FAILED yang dapat dicoba ulang.');
    error.statusCode = 400;
    error.code = 'JOB_NOT_FAILED';
    throw error;
  }

  if (job.type === 'DOCUMENT_EXTRACTION' && job.materialId) {
    await retryMaterialProcessing(job.userId, job.materialId);
    return {
      message: 'Pemrosesan ulang PDF berhasil dijadwalkan',
      jobId,
    };
  }

  if (
    job.type === 'AI_SUMMARY_GENERATION' ||
    job.type === 'AI_FLASHCARD_GENERATION' ||
    job.type === 'AI_QUIZ_GENERATION'
  ) {
    await prisma.processingJob.update({
      where: { id: jobId },
      data: {
        status: 'PENDING',
        attempts: 0,
        errorCode: null,
        errorMessage: null,
        failedAt: null,
        startedAt: null,
        completedAt: null,
      },
    });

    const eventTypeMap: Record<string, string> = {
      AI_SUMMARY_GENERATION: 'AI_SUMMARY_REQUESTED',
      AI_FLASHCARD_GENERATION: 'AI_FLASHCARDS_REQUESTED',
      AI_QUIZ_GENERATION: 'AI_QUIZ_REQUESTED',
    };
    const eventType = eventTypeMap[job.type];
    if (eventType) {
      await prisma.outboxEvent.create({
        data: {
          eventType,
          aggregateId: job.materialId || job.id,
          payload: {
            jobId: job.id,
            userId: job.userId,
            materialId: job.materialId,
            ...(typeof job.payload === 'object' && job.payload !== null ? job.payload : {}),
          },
        },
      });
      dispatchOutboxEvents().catch(() => {});
    }

    return {
      message: 'Pekerjaan AI berhasil dijadwalkan ulang',
      jobId,
    };
  }

  const error: AppError = new Error(`Jenis pekerjaan ${job.type} tidak mendukung retry otomatis.`);
  error.statusCode = 400;
  error.code = 'UNSUPPORTED_JOB_RETRY';
  throw error;
}

export async function deleteAdminJob(jobId: string): Promise<void> {
  const job = await prisma.processingJob.findUnique({
    where: { id: jobId },
  });
  if (!job) {
    const error: AppError = new Error('Pekerjaan tidak ditemukan');
    error.statusCode = 404;
    error.code = 'JOB_NOT_FOUND';
    throw error;
  }

  if (job.status !== 'COMPLETED' && job.status !== 'FAILED') {
    const error: AppError = new Error('Pekerjaan yang masih berjalan atau dalam antrean tidak dapat dihapus.');
    error.statusCode = 409;
    error.code = 'JOB_STILL_ACTIVE';
    throw error;
  }

  await prisma.processingJob.delete({
    where: { id: jobId },
  });
}

export async function cleanupAdminJobs(
  input: AdminCleanupJobsInput
): Promise<{ deletedCount: number }> {
  const where: any = {
    status: input.status,
  };
  if (input.olderThanDays > 0) {
    const cutoff = new Date(Date.now() - input.olderThanDays * 24 * 60 * 60 * 1000);
    where.createdAt = { lt: cutoff };
  }

  const result = await prisma.processingJob.deleteMany({
    where,
  });

  return {
    deletedCount: result.count,
  };
}

export async function listAdminAssignments(
  query: AdminAssignmentListQuery
): Promise<AdminAssignmentListResponse> {
  const { page = 1, limit = 20, search, status, priority, sortBy = 'createdAt', sortOrder = 'desc' } = query;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { course: { name: { contains: search, mode: 'insensitive' } } },
      { user: { name: { contains: search, mode: 'insensitive' } } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const now = new Date();

  const [totalItems, assignments] = await Promise.all([
    prisma.assignment.count({ where }),
    prisma.assignment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        course: { select: { name: true } },
        user: { select: { id: true, name: true, email: true } },
        subtasks: { select: { isCompleted: true } },
      },
    }),
  ]);

  const totalPages = Math.ceil(totalItems / limit) || 1;

  return {
    items: assignments.map((a) => {
      const isOverdue = a.status !== 'DONE' && a.dueDate < now;
      const subtasksCount = a.subtasks.length;
      const completedSubtasksCount = a.subtasks.filter((s) => s.isCompleted).length;

      return {
        id: a.id,
        title: a.title,
        courseName: a.course.name,
        dueDate: a.dueDate.toISOString(),
        priority: a.priority,
        status: a.status,
        isOverdue,
        subtasksCount,
        completedSubtasksCount,
        userId: a.user.id,
        userName: a.user.name,
        userEmail: a.user.email,
        createdAt: a.createdAt.toISOString(),
      };
    }),
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

export async function listAdminNotes(
  query: AdminNoteListQuery
): Promise<AdminNoteListResponse> {
  const { page = 1, limit = 20, search, sortBy = 'updatedAt', sortOrder = 'desc' } = query;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
      { course: { name: { contains: search, mode: 'insensitive' } } },
      { user: { name: { contains: search, mode: 'insensitive' } } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [totalItems, notes] = await Promise.all([
    prisma.note.count({ where }),
    prisma.note.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        course: { select: { name: true } },
        material: { select: { title: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  const totalPages = Math.ceil(totalItems / limit) || 1;

  return {
    items: notes.map((n) => ({
      id: n.id,
      title: n.title,
      courseName: n.course.name,
      materialTitle: n.material?.title || null,
      contentSnippet: n.content ? (n.content.length > 120 ? `${n.content.slice(0, 117)}...` : n.content) : '',
      userId: n.user.id,
      userName: n.user.name,
      userEmail: n.user.email,
      updatedAt: n.updatedAt.toISOString(),
    })),
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

export async function listAdminSchedules(
  query: AdminScheduleListQuery
): Promise<AdminScheduleListResponse> {
  const { page = 1, limit = 20, search, dayOfWeek, sortBy = 'dayOfWeek', sortOrder = 'asc' } = query;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (dayOfWeek) where.dayOfWeek = dayOfWeek;
  if (search) {
    where.OR = [
      { room: { contains: search, mode: 'insensitive' } },
      { course: { name: { contains: search, mode: 'insensitive' } } },
      { course: { code: { contains: search, mode: 'insensitive' } } },
      { user: { name: { contains: search, mode: 'insensitive' } } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [totalItems, schedules] = await Promise.all([
    prisma.courseSchedule.count({ where }),
    prisma.courseSchedule.findMany({
      where,
      skip,
      take: limit,
      orderBy: [
        { [sortBy]: sortOrder },
        { startTime: 'asc' },
      ],
      include: {
        course: { select: { name: true, code: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  const totalPages = Math.ceil(totalItems / limit) || 1;

  return {
    items: schedules.map((s) => ({
      id: s.id,
      courseName: s.course.name,
      courseCode: s.course.code,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      room: s.room,
      userId: s.user.id,
      userName: s.user.name,
      userEmail: s.user.email,
    })),
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

export async function listAdminQuizzes(
  query: AdminQuizListQuery
): Promise<AdminQuizListResponse> {
  const { page = 1, limit = 20, search, status, sortBy = 'createdAt', sortOrder = 'desc' } = query;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (status) where.status = status as any;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { material: { title: { contains: search, mode: 'insensitive' } } },
      { user: { name: { contains: search, mode: 'insensitive' } } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [totalItems, quizzes] = await Promise.all([
    prisma.quiz.count({ where }),
    prisma.quiz.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        material: { select: { title: true } },
        user: { select: { id: true, name: true, email: true } },
        attempts: { select: { score: true } },
      },
    }),
  ]);

  const totalPages = Math.ceil(totalItems / limit) || 1;

  return {
    items: quizzes.map((q) => {
      const attemptsCount = q.attempts.length;
      const averageScore =
        attemptsCount > 0
          ? Math.round(
              (q.attempts.reduce((acc, curr) => acc + curr.score, 0) / attemptsCount) * 10
            ) / 10
          : null;

      return {
        id: q.id,
        title: q.title,
        materialTitle: q.material.title,
        questionCount: q.questionCount,
        status: q.status,
        attemptsCount,
        averageScore,
        userId: q.user.id,
        userName: q.user.name,
        userEmail: q.user.email,
        createdAt: q.createdAt.toISOString(),
      };
    }),
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}



