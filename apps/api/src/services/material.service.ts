import crypto from 'node:crypto';
import { prisma, cancelMaterialJobsAtomically } from '@studyflow/database';
import {
  InitiateUploadInput,
  InitiateUploadResponse,
  FinalizeUploadResponse,
  Material,
  MaterialListItem,
  MaterialListQuery,
  UpdateMaterialInput,
  FILE_UPLOAD_LIMITS,
  AI_QUOTA_LIMITS,
} from '@studyflow/shared';
import { AppError } from '../middleware/errorHandler.js';
import { getStorageAdapter } from './storage.service.js';
import {
  checkAndReserveUploadQuota,
  releaseReservation,
} from './quota.service.js';
import { flushOutboxForRequest } from './outbox.service.js';
import { toCourseResponse } from './course.service.js';
import { env } from '../config/env.js';

export function toMaterialListItem(m: any): MaterialListItem {
  return {
    id: m.id,
    userId: m.userId,
    courseId: m.courseId,
    title: m.title,
    originalFilename: m.originalFilename,
    mimeType: m.mimeType,
    bytes: m.bytes,
    pageCount: m.pageCount,
    status: m.status,
    errorCode: m.errorCode,
    errorMessage: m.errorMessage,
    course: m.course ? toCourseResponse(m.course) : undefined,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    deletedAt: m.deletedAt ? m.deletedAt.toISOString() : null,
    isPinned: Array.isArray(m.pinnedItems)
      ? m.pinnedItems.length > 0
      : (typeof m.isPinned === 'boolean' ? m.isPinned : false),
  };
}

export function toMaterialDetail(m: any): Material {
  return {
    ...toMaterialListItem(m),
    storageKey: m.storageKey,
    pages: m.pages
      ? m.pages.map((p: any) => ({
          id: p.id,
          materialId: p.materialId,
          pageNumber: p.pageNumber,
          extractedText: p.extractedText,
          characterCount: p.characterCount,
          createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
        }))
      : undefined,
  };
}

export async function initiateUpload(
  userId: string,
  input: InitiateUploadInput
): Promise<InitiateUploadResponse> {
  // 1. Verify Course ownership & non-archived status
  const course = await prisma.course.findFirst({
    where: { id: input.courseId, userId },
    include: { semester: true },
  });

  if (!course) {
    const error: AppError = new Error('Mata kuliah tidak ditemukan');
    error.statusCode = 404;
    error.code = 'COURSE_NOT_FOUND';
    throw error;
  }

  if (course.archivedAt !== null) {
    const error: AppError = new Error(
      'Materi tidak dapat ditambahkan pada mata kuliah yang diarsipkan'
    );
    error.statusCode = 400;
    error.code = 'COURSE_ARCHIVED';
    throw error;
  }

  if (course.semester.archivedAt !== null) {
    const error: AppError = new Error(
      'Materi tidak dapat ditambahkan pada semester yang diarsipkan'
    );
    error.statusCode = 400;
    error.code = 'SEMESTER_ARCHIVED';
    throw error;
  }

  // 2. Client file validation constraints
  if (input.fileSize > FILE_UPLOAD_LIMITS.maxSizeBytes) {
    const error: AppError = new Error(
      `Ukuran file melebihi batas maksimal 20 MB (${(input.fileSize / (1024 * 1024)).toFixed(1)} MB)`
    );
    error.statusCode = 400;
    error.code = 'FILE_TOO_LARGE';
    throw error;
  }

  if (input.mimeType !== 'application/pdf') {
    const error: AppError = new Error('Hanya format PDF berbasis teks yang didukung');
    error.statusCode = 400;
    error.code = 'INVALID_MIME_TYPE';
    throw error;
  }

  // 3. Check & reserve storage quota atomically
  await checkAndReserveUploadQuota(userId, input.fileSize);

  // 4. Generate unique storage key: materials/<userId>/<uuid>.pdf
  const fileUuid = crypto.randomUUID();
  const sanitizedFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storageKey = `materials/${userId}/${fileUuid}-${sanitizedFilename}`;

  // 5. Create Material with UPLOADING status in database
  const material = await prisma.material.create({
    data: {
      userId,
      courseId: input.courseId,
      title: input.title,
      originalFilename: input.filename,
      storageKey,
      mimeType: input.mimeType,
      bytes: input.fileSize,
      status: 'UPLOADING',
    },
  });

  // 6. Request signed upload URL from Storage Adapter
  const storageAdapter = getStorageAdapter();
  let signedUploadResult;
  try {
    signedUploadResult = await storageAdapter.createSignedUploadUrl(storageKey);
  } catch (err: any) {
    signedUploadResult = { data: null, error: err };
  }

  if (signedUploadResult.error || !signedUploadResult.data) {
    // Release quota on adapter failure
    await releaseReservation(userId, input.fileSize, true);
    await prisma.material.delete({ where: { id: material.id } });

    const isUnavailable =
      signedUploadResult.error?.name === 'StorageUnavailableError' ||
      (signedUploadResult.error as any)?.code === 'STORAGE_UNAVAILABLE';

    const error: AppError = new Error(
      isUnavailable
        ? 'Layanan penyimpanan file belum dikonfigurasi atau sedang tidak tersedia. Fitur perkuliahan lainnya tetap dapat digunakan.'
        : 'Gagal menyiapkan saluran unggahan storage. Silakan coba lagi.'
    );
    error.statusCode = isUnavailable ? 503 : 500;
    error.code = isUnavailable ? 'STORAGE_UNAVAILABLE' : 'STORAGE_UPLOAD_URL_FAILED';
    throw error;
  }

  // Signed URL expiry default 2 hours (per Supabase default)
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  return {
    materialId: material.id,
    uploadUrl: signedUploadResult.data.signedUrl || signedUploadResult.data.url,
    signedUploadToken: signedUploadResult.data.token,
    storageKey,
    expiresAt,
  };
}

export async function finalizeUpload(
  userId: string,
  materialId: string
): Promise<FinalizeUploadResponse> {
  const material = await prisma.material.findFirst({
    where: { id: materialId, userId },
    include: { course: true },
  });

  if (!material) {
    const error: AppError = new Error('Materi tidak ditemukan');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  // Idempotency: if already QUEUED, PROCESSING, or READY, return existing state
  if (material.status !== 'UPLOADING') {
    const existingJob = await prisma.processingJob.findFirst({
      where: { materialId: material.id },
      orderBy: { createdAt: 'desc' },
    });
    return {
      material: toMaterialListItem(material),
      jobId: existingJob?.id || '',
    };
  }

  // 1. Verify object actually exists in storage
  const storageAdapter = getStorageAdapter();
  const info = await storageAdapter.info(material.storageKey);

  if (info.error || !info.data) {
    const error: AppError = new Error(
      'File belum ditemukan di storage. Pastikan transfer file telah selesai sebelum finalisasi.'
    );
    error.statusCode = 400;
    error.code = 'FILE_NOT_UPLOADED';
    throw error;
  }

  const actualUploadedSize =
    typeof info.data.size === 'number' ? info.data.size : null;
  if (
    actualUploadedSize !== null &&
    (actualUploadedSize > FILE_UPLOAD_LIMITS.maxSizeBytes ||
      actualUploadedSize > material.bytes)
  ) {
    await storageAdapter.remove([material.storageKey]).catch(() => {});
    await prisma.material.update({
      where: { id: material.id },
      data: {
        status: 'FAILED',
        errorCode: 'FILE_TOO_LARGE',
        errorMessage:
          'Ukuran berkas aktual melebihi ukuran yang dideklarasikan atau batas maksimal 20 MiB.',
      },
    });
    await releaseReservation(userId, material.bytes, false);
    const error: AppError = new Error(
      'Ukuran berkas aktual melebihi ukuran yang dideklarasikan atau batas maksimal 20 MiB.'
    );
    error.statusCode = 400;
    error.code = 'FILE_SIZE_MISMATCH';
    throw error;
  }

  // 2. Transaction to update Material -> QUEUED, create ProcessingJob & OutboxEvent
  const jobId = crypto.randomUUID();
  const idempotencyKey = `extract-${material.id}-attempt-1`;

  const updatedMaterial = await prisma.$transaction(async (tx) => {
    const updated = await tx.material.update({
      where: { id: material.id },
      data: {
        status: 'QUEUED',
        errorCode: null,
        errorMessage: null,
      },
      include: {
        course: {
          include: { semester: true },
        },
      },
    });

    await tx.processingJob.create({
      data: {
        id: jobId,
        userId,
        materialId: material.id,
        type: 'DOCUMENT_EXTRACTION',
        status: 'PENDING',
        attempts: 0,
        maxAttempts: 3,
        idempotencyKey,
        payload: {
          materialId: material.id,
          userId,
          storageKey: material.storageKey,
          declaredBytes: material.bytes,
        },
      },
    });

    await tx.outboxEvent.create({
      data: {
        eventType: 'DOCUMENT_PROCESSING_REQUESTED',
        aggregateId: material.id,
        payload: {
          jobId,
          materialId: material.id,
          userId,
          storageKey: material.storageKey,
          declaredBytes: material.bytes,
        },
      },
    });

    return updated;
  });

  // 3. Flush targeted outbox event with bounded timeout so serverless functions do not freeze before enqueue
  await flushOutboxForRequest({ aggregateId: material.id });

  return {
    material: toMaterialListItem(updatedMaterial),
    jobId,
  };
}

export async function listMaterials(
  userId: string,
  query: MaterialListQuery
): Promise<{
  materials: MaterialListItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}> {
  const where: any = {
    userId,
    deletedAt: null, // do not list soft-deleted materials
  };

  if (query.courseId) {
    where.courseId = query.courseId;
  }

  if (query.semesterId) {
    where.course = {
      ...(where.course || {}),
      semesterId: query.semesterId,
    };
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.search) {
    where.title = {
      contains: query.search,
      mode: 'insensitive',
    };
  }

  const page =
    typeof query.page === 'number'
      ? query.page
      : query.page
        ? parseInt(String(query.page), 10) || 1
        : 1;
  const limit =
    typeof query.limit === 'number'
      ? query.limit
      : query.limit
        ? parseInt(String(query.limit), 10) || 20
        : 20;
  const skip = (page - 1) * limit;

  const [total, rawMaterials] = await Promise.all([
    prisma.material.count({ where }),
    prisma.material.findMany({
      where,
      include: {
        course: {
          include: { semester: true },
        },
        pinnedItems: {
          where: { userId },
          select: { id: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip,
      take: limit,
    }),
  ]);

  return {
    materials: rawMaterials.map(toMaterialListItem),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getMaterialById(userId: string, id: string): Promise<Material> {
  const material = await prisma.material.findFirst({
    where: { id, userId, deletedAt: null },
    include: {
      course: {
        include: { semester: true },
      },
      pinnedItems: {
        where: { userId },
        select: { id: true },
      },
      pages: {
        orderBy: { pageNumber: 'asc' },
      },
    },
  });

  if (!material) {
    const error: AppError = new Error('Materi tidak ditemukan');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  return toMaterialDetail(material);
}

export async function updateMaterial(
  userId: string,
  id: string,
  input: UpdateMaterialInput
): Promise<MaterialListItem> {
  const material = await prisma.material.findFirst({
    where: { id, userId, deletedAt: null },
    include: {
      course: {
        include: { semester: true },
      },
    },
  });

  if (!material) {
    const error: AppError = new Error('Materi tidak ditemukan');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (material.course.archivedAt !== null) {
    const error: AppError = new Error(
      'Materi pada mata kuliah yang diarsipkan bersifat hanya-baca. Pulihkan mata kuliah terlebih dahulu.'
    );
    error.statusCode = 400;
    error.code = 'COURSE_ARCHIVED';
    throw error;
  }

  if (material.course.semester.archivedAt !== null) {
    const error: AppError = new Error(
      'Materi pada semester yang diarsipkan bersifat hanya-baca. Pulihkan semester terlebih dahulu.'
    );
    error.statusCode = 400;
    error.code = 'SEMESTER_ARCHIVED';
    throw error;
  }

  const updated = await prisma.material.update({
    where: { id },
    data: {
      title: input.title,
    },
    include: {
      course: {
        include: { semester: true },
      },
    },
  });

  return toMaterialListItem(updated);
}

export async function retryMaterialProcessing(
  userId: string,
  id: string
): Promise<{ message: string; jobId: string }> {
  const material = await prisma.material.findFirst({
    where: { id, userId, deletedAt: null },
    include: {
      course: {
        include: { semester: true },
      },
    },
  });

  if (!material) {
    const error: AppError = new Error('Materi tidak ditemukan');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (material.course.archivedAt !== null || material.course.semester.archivedAt !== null) {
    const error: AppError = new Error(
      'Mata kuliah atau semester sedang diarsipkan. Pemrosesan tidak dapat diulang.'
    );
    error.statusCode = 400;
    error.code = 'COURSE_ARCHIVED';
    throw error;
  }

  if (material.status !== 'FAILED') {
    const error: AppError = new Error(
      `Pemrosesan hanya dapat diulang untuk materi berstatus FAILED (status saat ini: ${material.status})`
    );
    error.statusCode = 400;
    error.code = 'CANNOT_RETRY';
    throw error;
  }

  // Check permanent failure codes that cannot be retried
  const permanentErrorCodes = [
    'INVALID_FILE_SIGNATURE',
    'FILE_CORRUPTED',
    'FILE_ENCRYPTED',
    'EXCEEDS_PAGE_LIMIT',
    'FILE_TOO_LARGE',
    'SCANNED_PDF_NO_TEXT',
  ];
  if (material.errorCode && permanentErrorCodes.includes(material.errorCode)) {
    const error: AppError = new Error(
      `File tidak valid (${material.errorCode}). Silakan unggah file PDF berbasis teks pengganti sebagai materi baru.`
    );
    error.statusCode = 400;
    error.code = 'PERMANENT_FAILURE_CANNOT_RETRY';
    throw error;
  }

  // Check rate limit on retries (max attempts on jobs)
  const previousJobsCount = await prisma.processingJob.count({
    where: { materialId: material.id },
  });
  if (previousJobsCount >= 6) {
    const error: AppError = new Error(
      'Batas pengulangan maksimal untuk materi ini telah tercapai. Silakan unggah kembali dokumen Anda.'
    );
    error.statusCode = 429;
    error.code = 'MAX_RETRIES_EXCEEDED';
    throw error;
  }

  const jobId = crypto.randomUUID();
  const idempotencyKey = `extract-${material.id}-retry-${previousJobsCount + 1}`;

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    // 1. Ensure storage_usages row exists
    await tx.$executeRaw`
      INSERT INTO storage_usages (id, user_id, used_bytes, reserved_bytes, created_at, updated_at)
      VALUES (gen_random_uuid(), ${userId}, 0, 0, ${now}, ${now})
      ON CONFLICT (user_id) DO NOTHING
    `;

    // 2. Lock storage_usages row exclusively with SELECT ... FOR UPDATE
    const lockedStorage = await tx.$queryRaw<
      Array<{
        used_bytes: bigint | number;
        reserved_bytes: bigint | number;
      }>
    >`
      SELECT used_bytes, reserved_bytes
      FROM storage_usages
      WHERE user_id = ${userId}
      FOR UPDATE
    `;

    if (!lockedStorage || lockedStorage.length === 0) {
      throw new Error('Gagal mengunci catatan penggunaan penyimpanan');
    }
    const storage = lockedStorage[0]!;

    const currentTotal = Number(storage.used_bytes) + Number(storage.reserved_bytes);
    if (currentTotal + material.bytes > AI_QUOTA_LIMITS.storageLimitBytes) {
      const remainingBytes = Math.max(0, AI_QUOTA_LIMITS.storageLimitBytes - currentTotal);
      const remainingMb = (remainingBytes / (1024 * 1024)).toFixed(1);
      const error: AppError = new Error(
        `Kapasitas penyimpanan tidak mencukupi untuk mencoba ulang. Sisa kuota: ${remainingMb} MB dari total 200 MB.`
      );
      error.statusCode = 400;
      error.code = 'STORAGE_LIMIT_EXCEEDED';
      throw error;
    }

    await tx.storageUsage.update({
      where: { userId },
      data: {
        reservedBytes: {
          increment: BigInt(material.bytes),
        },
      },
    });

    await tx.material.update({
      where: { id: material.id },
      data: {
        status: 'QUEUED',
        errorCode: null,
        errorMessage: null,
      },
    });

    await tx.processingJob.create({
      data: {
        id: jobId,
        userId,
        materialId: material.id,
        type: 'DOCUMENT_EXTRACTION',
        status: 'PENDING',
        attempts: 0,
        maxAttempts: 3,
        idempotencyKey,
        payload: {
          materialId: material.id,
          userId,
          storageKey: material.storageKey,
          declaredBytes: material.bytes,
        },
      },
    });

    await tx.outboxEvent.create({
      data: {
        eventType: 'DOCUMENT_PROCESSING_REQUESTED',
        aggregateId: material.id,
        payload: {
          jobId,
          materialId: material.id,
          userId,
          storageKey: material.storageKey,
          declaredBytes: material.bytes,
        },
      },
    });
  });

  await flushOutboxForRequest({ aggregateId: material.id });

  return {
    message: 'Pemrosesan ulang PDF berhasil dijadwalkan',
    jobId,
  };
}

export async function deleteMaterial(userId: string, id: string): Promise<void> {
  const material = await prisma.material.findFirst({
    where: { id, userId, deletedAt: null },
    include: {
      course: {
        include: { semester: true },
      },
    },
  });

  if (!material) {
    const error: AppError = new Error('Materi tidak ditemukan');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (material.course.archivedAt !== null || material.course.semester.archivedAt !== null) {
    const error: AppError = new Error(
      'Materi pada mata kuliah atau semester yang diarsipkan bersifat hanya-baca dan tidak dapat dihapus.'
    );
    error.statusCode = 400;
    error.code = 'COURSE_ARCHIVED';
    throw error;
  }

  // 1. Atomically soft-delete material, unlink notes, clean up downstream AI, cancel jobs, and adjust storage
  let bytesToFree = material.bytes;
  let isReady = material.status === 'READY';

  await prisma.$transaction(async (tx) => {
    // Lock material row to evaluate committed status and prevent concurrent modifications
    const matRows = await tx.$queryRaw<
      Array<{ status: string; bytes: number }>
    >`
      SELECT status, bytes
      FROM materials
      WHERE id = ${material.id} AND user_id = ${userId} AND deleted_at IS NULL
      FOR UPDATE
    `;

    if (matRows.length === 0) {
      // Already deleted or not found: exit cleanly without duplicate quota decrement
      return;
    }

    const currentMaterial = matRows[0]!;
    isReady = currentMaterial.status === 'READY';
    bytesToFree = currentMaterial.bytes;

    // Soft-delete material immediately so it cannot be queried or updated
    await tx.material.update({
      where: { id: material.id },
      data: {
        deletedAt: new Date(),
      },
    });

    // Remove any pin entries referencing this material so soft-deleted materials do not consume pin quota
    await tx.pinnedItem.deleteMany({
      where: { materialId: material.id },
    });

    // Unlink notes attached to this material
    await tx.note.updateMany({
      where: { materialId: material.id },
      data: { materialId: null },
    });

    // Explicitly clean up downstream AI and attempt records per PRD retention policy
    // (SQL ON DELETE CASCADE does not trigger on soft delete)
    await tx.quizAttempt.deleteMany({
      where: { quiz: { materialId: material.id } },
    });
    await tx.quiz.deleteMany({
      where: { materialId: material.id },
    });
    await tx.flashcardSet.deleteMany({
      where: { materialId: material.id },
    });
    await tx.materialSummary.deleteMany({
      where: { materialId: material.id },
    });
    await tx.materialPage.deleteMany({
      where: { materialId: material.id },
    });

    // Atomically cancel all active jobs (both PENDING and PROCESSING) for this material
    // and release held AI slots if any active AI jobs were cancelled
    await cancelMaterialJobsAtomically({
      materialId: material.id,
      userId,
      tx,
    });

    // Adjust storage usage atomically inside the same transaction
    if (isReady) {
      await tx.$executeRaw`
        UPDATE storage_usages
        SET used_bytes = GREATEST(0, used_bytes - ${bytesToFree}),
            updated_at = NOW()
        WHERE user_id = ${userId}
      `;
    } else if (
      currentMaterial.status === 'UPLOADING' ||
      currentMaterial.status === 'QUEUED' ||
      currentMaterial.status === 'PROCESSING'
    ) {
      await tx.$executeRaw`
        UPDATE storage_usages
        SET reserved_bytes = GREATEST(0, reserved_bytes - ${bytesToFree}),
            updated_at = NOW()
        WHERE user_id = ${userId}
      `;
    }

    // Create background cleanup job event in outbox
    await tx.outboxEvent.create({
      data: {
        eventType: 'DOCUMENT_CLEANUP_REQUESTED',
        aggregateId: material.id,
        payload: {
          materialId: material.id,
          userId,
          storageKey: material.storageKey,
          bytesToFree,
          isReady,
        },
      },
    });
  });

  // 3. Flush cleanup outbox event (removes storage object and marks outbox event PUBLISHED, or retains PENDING on error)
  await flushOutboxForRequest({ aggregateId: material.id });
}

export async function getMaterialDownloadUrl(
  userId: string,
  id: string
): Promise<{ downloadUrl: string; expiresInSeconds: number; expiresAt: string }> {
  const material = await prisma.material.findFirst({
    where: { id, userId, deletedAt: null },
  });

  if (!material) {
    const error: AppError = new Error('Materi tidak ditemukan');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (material.status !== 'READY') {
    const error: AppError = new Error(
      'Materi belum siap untuk diunduh atau dipratinjau.'
    );
    error.statusCode = 409;
    error.code = 'MATERIAL_NOT_READY';
    throw error;
  }

  const expiresInSeconds = env.STORAGE_SIGNED_URL_EXPIRES_IN || 300; // 5 minutes
  const storageAdapter = getStorageAdapter();
  let res;
  try {
    res = await storageAdapter.createSignedUrl(material.storageKey, expiresInSeconds);
  } catch (err: any) {
    res = { data: null, error: err };
  }

  if (res.error || !res.data) {
    const isUnavailable =
      res.error?.name === 'StorageUnavailableError' ||
      (res.error as any)?.code === 'STORAGE_UNAVAILABLE';

    const error: AppError = new Error(
      isUnavailable
        ? 'Layanan penyimpanan file sedang tidak tersedia.'
        : 'Gagal membuat tautan unduh/pratinjau yang aman'
    );
    error.statusCode = isUnavailable ? 503 : 500;
    error.code = isUnavailable ? 'STORAGE_UNAVAILABLE' : 'DOWNLOAD_URL_FAILED';
    throw error;
  }

  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

  return {
    downloadUrl: res.data.signedUrl,
    expiresInSeconds,
    expiresAt,
  };
}

export async function getProcessingJobStatus(userId: string, jobId: string) {
  const job = await prisma.processingJob.findFirst({
    where: { id: jobId, userId },
  });

  if (!job) {
    const error: AppError = new Error('Pekerjaan tidak ditemukan');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  return {
    id: job.id,
    materialId: job.materialId,
    type: job.type,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    startedAt: job.startedAt?.toISOString() || null,
    completedAt: job.completedAt?.toISOString() || null,
    failedAt: job.failedAt?.toISOString() || null,
  };
}

/**
 * Sweeps abandoned uploads stuck in UPLOADING status beyond maxAgeMs (default 2 hours).
 * Marks them FAILED with code UPLOAD_ABANDONED and safely releases reserved quota.
 */
export async function sweepAbandonedUploads(
  maxAgeMs = 2 * 60 * 60 * 1000
): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeMs);
  const abandoned = await prisma.material.findMany({
    where: {
      status: 'UPLOADING',
      deletedAt: null,
      createdAt: { lt: cutoff },
    },
    take: 50,
  });

  if (abandoned.length === 0) return 0;

  let sweptCount = 0;
  const storageAdapter = getStorageAdapter();

  for (const mat of abandoned) {
    try {
      await prisma.material.update({
        where: { id: mat.id },
        data: {
          status: 'FAILED',
          errorCode: 'UPLOAD_ABANDONED',
          errorMessage: 'Unggahan dibatalkan atau melebihi batas waktu maksimal (2 jam).',
        },
      });

      // Release reserved storage bytes and free daily counter slot if needed
      await releaseReservation(mat.userId, mat.bytes, true);

      // Clean up any partially written object in storage
      await storageAdapter.remove([mat.storageKey]).catch(() => {});
      sweptCount++;
    } catch (err) {
      console.error(`[AbandonedUploads] Failed to clean up material ${mat.id}:`, err);
    }
  }

  return sweptCount;
}

