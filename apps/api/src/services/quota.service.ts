import { prisma } from '@studyflow/database';
import { AI_QUOTA_LIMITS, getUtcDateString } from '@studyflow/shared';
import { AppError } from '../middleware/errorHandler.js';

export async function checkAndReserveUploadQuota(
  userId: string,
  declaredSizeBytes: number
): Promise<{
  storageUsage: { usedBytes: number; reservedBytes: number };
  dailyCount: number;
}> {
  const todayUtc = getUtcDateString(new Date());

  // 1. Transaction to atomically verify daily counter and reserve storage
  const result = await prisma.$transaction(async (tx) => {
    // A. Daily upload counter
    const counter = await tx.dailyUploadCounter.upsert({
      where: {
        userId_uploadDate: {
          userId,
          uploadDate: todayUtc,
        },
      },
      create: {
        userId,
        uploadDate: todayUtc,
        uploadCount: 0,
      },
      update: {},
    });

    if (counter.uploadCount >= AI_QUOTA_LIMITS.dailyUploads) {
      const error: AppError = new Error(
        `Batas unggahan harian tercapai (${AI_QUOTA_LIMITS.dailyUploads} file/hari). Kuota akan direset pada pukul 00.00 UTC.`
      );
      error.statusCode = 429;
      error.code = 'DAILY_UPLOAD_LIMIT_EXCEEDED';
      throw error;
    }

    // B. Storage usage (usedBytes + reservedBytes)
    const usage = await tx.storageUsage.upsert({
      where: { userId },
      create: {
        userId,
        usedBytes: BigInt(0),
        reservedBytes: BigInt(0),
      },
      update: {},
    });

    const currentTotal = Number(usage.usedBytes) + Number(usage.reservedBytes);
    if (currentTotal + declaredSizeBytes > AI_QUOTA_LIMITS.storageLimitBytes) {
      const remainingBytes = Math.max(0, AI_QUOTA_LIMITS.storageLimitBytes - currentTotal);
      const remainingMb = (remainingBytes / (1024 * 1024)).toFixed(1);
      const error: AppError = new Error(
        `Kapasitas penyimpanan tidak mencukupi. Sisa kuota: ${remainingMb} MB dari total 200 MB.`
      );
      error.statusCode = 400;
      error.code = 'STORAGE_LIMIT_EXCEEDED';
      throw error;
    }

    // Increment reservedBytes and daily count atomically
    const updatedUsage = await tx.storageUsage.update({
      where: { userId },
      data: {
        reservedBytes: {
          increment: BigInt(declaredSizeBytes),
        },
      },
    });

    const updatedCounter = await tx.dailyUploadCounter.update({
      where: {
        userId_uploadDate: {
          userId,
          uploadDate: todayUtc,
        },
      },
      data: {
        uploadCount: {
          increment: 1,
        },
      },
    });

    return {
      storageUsage: {
        usedBytes: Number(updatedUsage.usedBytes),
        reservedBytes: Number(updatedUsage.reservedBytes),
      },
      dailyCount: updatedCounter.uploadCount,
    };
  });

  return result;
}

export async function consumeReservationAndCommitUsage(
  userId: string,
  declaredReservationBytes: number,
  actualSizeBytes: number
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const usage = await tx.storageUsage.findUnique({
      where: { userId },
    });
    if (!usage) return;

    const currentReserved = Number(usage.reservedBytes);
    const toDecrement = Math.min(currentReserved, declaredReservationBytes);

    await tx.storageUsage.update({
      where: { userId },
      data: {
        reservedBytes: {
          decrement: BigInt(toDecrement),
        },
        usedBytes: {
          increment: BigInt(actualSizeBytes),
        },
      },
    });
  });
}

export async function releaseReservation(
  userId: string,
  declaredReservationBytes: number,
  decrementDailyCounter = false
): Promise<void> {
  const todayUtc = getUtcDateString(new Date());

  await prisma.$transaction(async (tx) => {
    const usage = await tx.storageUsage.findUnique({
      where: { userId },
    });
    if (usage) {
      const currentReserved = Number(usage.reservedBytes);
      const toDecrement = Math.min(currentReserved, declaredReservationBytes);
      if (toDecrement > 0) {
        await tx.storageUsage.update({
          where: { userId },
          data: {
            reservedBytes: {
              decrement: BigInt(toDecrement),
            },
          },
        });
      }
    }

    if (decrementDailyCounter) {
      const counter = await tx.dailyUploadCounter.findUnique({
        where: {
          userId_uploadDate: {
            userId,
            uploadDate: todayUtc,
          },
        },
      });
      if (counter && counter.uploadCount > 0) {
        await tx.dailyUploadCounter.update({
          where: {
            userId_uploadDate: {
              userId,
              uploadDate: todayUtc,
            },
          },
          data: {
            uploadCount: {
              decrement: 1,
            },
          },
        });
      }
    }
  });
}

export async function releaseUsedStorage(
  userId: string,
  bytesToFree: number
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const usage = await tx.storageUsage.findUnique({
      where: { userId },
    });
    if (!usage) return;

    const currentUsed = Number(usage.usedBytes);
    const toDecrement = Math.min(currentUsed, bytesToFree);
    if (toDecrement > 0) {
      await tx.storageUsage.update({
        where: { userId },
        data: {
          usedBytes: {
            decrement: BigInt(toDecrement),
          },
        },
      });
    }
  });
}

export async function getUserStorageUsage(userId: string) {
  const todayUtc = getUtcDateString(new Date());

  const [usage, counter] = await Promise.all([
    prisma.storageUsage.findUnique({ where: { userId } }),
    prisma.dailyUploadCounter.findUnique({
      where: {
        userId_uploadDate: {
          userId,
          uploadDate: todayUtc,
        },
      },
    }),
  ]);

  const usedBytes = usage ? Number(usage.usedBytes) : 0;
  const limitBytes = AI_QUOTA_LIMITS.storageLimitBytes;
  const percentage = Math.min(100, Math.round((usedBytes / limitBytes) * 100));

  return {
    usedBytes,
    limitBytes,
    percentage,
    dailyUploadsCount: counter?.uploadCount || 0,
    dailyUploadsLimit: AI_QUOTA_LIMITS.dailyUploads,
    dailyResetUtc: '00:00 UTC',
    dailyResetUserTimezone: '00:00 UTC',
  };
}
