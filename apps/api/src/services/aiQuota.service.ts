import { prisma } from '@studyflow/database';

export const AI_QUOTA_CONFIG = {
  DAILY_LIMIT: 20,
  MAX_CONCURRENT_JOBS: 2,
};

export class AiQuotaError extends Error {
  constructor(
    public code: 'AI_DAILY_QUOTA_EXCEEDED' | 'AI_CONCURRENT_LIMIT_EXCEEDED',
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AiQuotaError';
  }
}

/**
 * Checks if a given date is from a previous UTC calendar day compared to now.
 */
function isDifferentUtcDay(lastDate: Date, now: Date): boolean {
  return (
    lastDate.getUTCFullYear() !== now.getUTCFullYear() ||
    lastDate.getUTCMonth() !== now.getUTCMonth() ||
    lastDate.getUTCDate() !== now.getUTCDate()
  );
}

/**
 * Gets the current AI quota status for a user, taking UTC midnight reset into account.
 */
export async function getUserAiQuotaStatus(userId: string) {
  const now = new Date();
  let usage = await prisma.aiUsage.findUnique({
    where: { userId },
  });

  if (!usage) {
    return {
      dailyCount: 0,
      dailyLimit: AI_QUOTA_CONFIG.DAILY_LIMIT,
      activeJobs: 0,
      maxConcurrent: AI_QUOTA_CONFIG.MAX_CONCURRENT_JOBS,
      canGenerate: true,
      lastResetUtc: now.toISOString(),
    };
  }

  // Check if daily count needs rollover
  let dailyCount = usage.dailyGenerationCount;
  if (isDifferentUtcDay(usage.lastResetUtc, now)) {
    dailyCount = 0;
  }

  return {
    dailyCount,
    dailyLimit: AI_QUOTA_CONFIG.DAILY_LIMIT,
    activeJobs: usage.activeJobsCount,
    maxConcurrent: AI_QUOTA_CONFIG.MAX_CONCURRENT_JOBS,
    canGenerate: dailyCount < AI_QUOTA_CONFIG.DAILY_LIMIT && usage.activeJobsCount < AI_QUOTA_CONFIG.MAX_CONCURRENT_JOBS,
    lastResetUtc: usage.lastResetUtc.toISOString(),
  };
}

/**
 * Atomically checks and reserves AI generation quota inside a Prisma transaction.
 * Throws AiQuotaError if daily limit or concurrent job limit is exceeded.
 */
/**
 * Atomically checks and reserves AI generation quota inside a Prisma transaction
 * using PostgreSQL row-level locking (SELECT ... FOR UPDATE) to guarantee race-condition freedom.
 * Throws AiQuotaError if daily limit or concurrent job limit is exceeded.
 */
export async function checkAndReserveAiQuota(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  userId: string
) {
  const now = new Date();

  // 1. Ensure ai_usages row exists for userId
  await tx.$executeRaw`
    INSERT INTO ai_usages (id, user_id, daily_generation_count, active_jobs_count, last_reset_utc, created_at, updated_at)
    VALUES (gen_random_uuid(), ${userId}, 0, 0, ${now}, ${now}, ${now})
    ON CONFLICT (user_id) DO NOTHING
  `;

  // 2. Lock the row exclusively with SELECT ... FOR UPDATE
  const lockedRows = await tx.$queryRaw<
    Array<{
      id: string;
      user_id: string;
      daily_generation_count: number;
      active_jobs_count: number;
      last_reset_utc: Date;
    }>
  >`
    SELECT id, user_id, daily_generation_count, active_jobs_count, last_reset_utc
    FROM ai_usages
    WHERE user_id = ${userId}
    FOR UPDATE
  `;

  if (!lockedRows || lockedRows.length === 0) {
    throw new Error('Gagal mengunci catatan kuota AI pengguna');
  }

  const usage = lockedRows[0];
  if (!usage) {
    throw new Error('Gagal membaca catatan kuota AI pengguna');
  }

  // 3. Check UTC day rollover
  let currentDailyCount = usage.daily_generation_count;
  let resetTime = usage.last_reset_utc;

  if (isDifferentUtcDay(new Date(usage.last_reset_utc), now)) {
    currentDailyCount = 0;
    resetTime = now;
  }

  // 4. Verify daily limit
  if (currentDailyCount >= AI_QUOTA_CONFIG.DAILY_LIMIT) {
    throw new AiQuotaError(
      'AI_DAILY_QUOTA_EXCEEDED',
      `Batas kuota harian pembuatan ringkasan AI telah tercapai (${AI_QUOTA_CONFIG.DAILY_LIMIT} ringkasan/hari). Kuota akan direset pada 00:00 UTC.`,
      {
        dailyCount: currentDailyCount,
        dailyLimit: AI_QUOTA_CONFIG.DAILY_LIMIT,
      }
    );
  }

  // 5. Verify concurrent active jobs limit
  if (usage.active_jobs_count >= AI_QUOTA_CONFIG.MAX_CONCURRENT_JOBS) {
    throw new AiQuotaError(
      'AI_CONCURRENT_LIMIT_EXCEEDED',
      `Maksimal ${AI_QUOTA_CONFIG.MAX_CONCURRENT_JOBS} proses pembuatan ringkasan AI dapat berjalan bersamaan. Silakan tunggu proses sebelumnya selesai.`,
      {
        activeJobs: usage.active_jobs_count,
        maxConcurrent: AI_QUOTA_CONFIG.MAX_CONCURRENT_JOBS,
      }
    );
  }

  // 6. Atomically update usage under lock
  const updatedUsage = await tx.aiUsage.update({
    where: { userId },
    data: {
      dailyGenerationCount: currentDailyCount + 1,
      activeJobsCount: { increment: 1 },
      lastResetUtc: resetTime,
    },
  });

  return {
    dailyCount: updatedUsage.dailyGenerationCount,
    dailyLimit: AI_QUOTA_CONFIG.DAILY_LIMIT,
    activeJobs: updatedUsage.activeJobsCount,
    maxConcurrent: AI_QUOTA_CONFIG.MAX_CONCURRENT_JOBS,
  };
}

/**
 * Decrements the active AI jobs count when a job finishes or fails.
 * If jobId is provided, guarantees atomic transition to avoid double release on duplicates.
 */
export async function releaseAiJobSlot(userId: string, jobId?: string): Promise<boolean> {
  if (jobId) {
    const updated = await prisma.$executeRaw`
      UPDATE processing_jobs
      SET status = 'FAILED'::"ProcessingJobStatus",
          updated_at = NOW()
      WHERE id = ${jobId} AND status IN ('PENDING', 'PROCESSING')
    `;
    if (updated === 0) {
      return false; // Job was already finalized
    }
  }

  await prisma.$executeRaw`
    UPDATE ai_usages
    SET active_jobs_count = GREATEST(0, active_jobs_count - 1),
        updated_at = NOW()
    WHERE user_id = ${userId} AND active_jobs_count > 0
  `;
  return true;
}

/**
 * Refunds a daily generation count in case of early system cancellation
 * before external LLM was invoked.
 */
export async function refundDailyGeneration(userId: string): Promise<void> {
  const usage = await prisma.aiUsage.findUnique({
    where: { userId },
  });

  if (usage && usage.dailyGenerationCount > 0) {
    await prisma.aiUsage.update({
      where: { userId },
      data: {
        dailyGenerationCount: {
          decrement: 1,
        },
      },
    });
  }
}
