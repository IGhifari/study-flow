import crypto from 'node:crypto';
import { prisma } from '@studyflow/database';
import type {
  AdminLoginInput,
  AdminSummary,
  AdminUserListQuery,
  AdminUserListResponse,
  AdminUserDetail,
  AdminJobListQuery,
  AdminJobListResponse,
  AdminJobDetail,
  AdminJobType,
  AdminJobStatus,
  AdminQueueStatus,
  AdminQueueSummaryItem,
  AdminQueuesSummaryResponse,
  UserProfile,
  Role,
} from '@studyflow/shared';
import { QUEUE_NAMES } from '@studyflow/shared';
import { getDocumentProcessingQueue, getAiGenerationQueue } from './outbox.service.js';
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
  const [semesters, courses, materials, assignments, notes, storageRecord] = await Promise.all([
    prisma.semester.count({ where: { userId } }),
    prisma.course.count({ where: { userId } }),
    prisma.material.count({ where: { userId, deletedAt: null } }),
    prisma.assignment.count({ where: { userId } }),
    prisma.note.count({ where: { userId } }),
    prisma.storageUsage.findUnique({
      where: { userId },
      select: { usedBytes: true },
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
    },
  };
}

export function formatSafeErrorMessage(errorCode: string | null): string | null {
  if (!errorCode) return null;
  const errorMap: Record<string, string> = {
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
  const { type, status, userId, jobId, startDate, endDate, sortBy = 'createdAt', sortOrder = 'desc' } = query;

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


