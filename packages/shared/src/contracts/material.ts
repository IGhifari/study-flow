import { z } from 'zod';
import { CourseSchema } from './course.js';

export const MaterialStatusEnum = z.enum([
  'UPLOADING',
  'QUEUED',
  'PROCESSING',
  'READY',
  'FAILED',
]);
export type MaterialStatus = z.infer<typeof MaterialStatusEnum>;

export const MaterialPageSchema = z.object({
  id: z.string(),
  materialId: z.string(),
  pageNumber: z.number().int().positive(),
  extractedText: z.string(),
  characterCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});
export type MaterialPage = z.infer<typeof MaterialPageSchema>;

export const ProcessingJobTypeEnum = z.enum([
  'DOCUMENT_EXTRACTION',
  'DOCUMENT_CLEANUP',
]);
export type ProcessingJobType = z.infer<typeof ProcessingJobTypeEnum>;

export const ProcessingJobStatusEnum = z.enum([
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
]);
export type ProcessingJobStatus = z.infer<typeof ProcessingJobStatusEnum>;

export const ProcessingJobSchema = z.object({
  id: z.string(),
  userId: z.string(),
  materialId: z.string().nullable().optional(),
  type: ProcessingJobTypeEnum,
  status: ProcessingJobStatusEnum,
  attempts: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  idempotencyKey: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  errorCode: z.string().nullable().optional(),
  payload: z.record(z.any()).nullable().optional(),
  startedAt: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  failedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ProcessingJob = z.infer<typeof ProcessingJobSchema>;

export const MaterialSchema = z.object({
  id: z.string(),
  userId: z.string(),
  courseId: z.string(),
  title: z.string(),
  originalFilename: z.string(),
  storageKey: z.string(),
  mimeType: z.string(),
  bytes: z.number().int().nonnegative(),
  pageCount: z.number().int().nonnegative().nullable().optional(),
  status: MaterialStatusEnum,
  errorCode: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  course: CourseSchema.optional(),
  activeJobId: z.string().nullable().optional(),
  pages: z.array(MaterialPageSchema).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().optional(),
});
export type Material = z.infer<typeof MaterialSchema>;

export const MaterialListItemSchema = MaterialSchema.omit({
  storageKey: true,
});
export type MaterialListItem = z.infer<typeof MaterialListItemSchema>;

// Input & Query schemas
export const InitiateUploadInputSchema = z.object({
  courseId: z.string().min(1, 'Mata kuliah wajib dipilih'),
  title: z
    .string()
    .trim()
    .min(1, 'Judul materi minimal 1 karakter')
    .max(200, 'Judul materi maksimal 200 karakter'),
  filename: z.string().trim().min(1, 'Nama file wajib diisi'),
  fileSize: z
    .number()
    .int()
    .positive('Ukuran file harus lebih dari 0')
    .max(20 * 1024 * 1024, 'Ukuran file maksimal 20 MB'),
  mimeType: z
    .string()
    .refine((val) => val === 'application/pdf', 'Hanya format PDF berbasis teks yang didukung'),
});
export type InitiateUploadInput = z.infer<typeof InitiateUploadInputSchema>;

export const InitiateUploadResponseSchema = z.object({
  materialId: z.string(),
  uploadUrl: z.string(),
  signedUploadToken: z.string().optional(),
  storageKey: z.string(),
  expiresAt: z.string().datetime(),
});
export type InitiateUploadResponse = z.infer<typeof InitiateUploadResponseSchema>;

export const FinalizeUploadInputSchema = z.object({
  materialId: z.string().min(1, 'ID materi wajib disertakan'),
});
export type FinalizeUploadInput = z.infer<typeof FinalizeUploadInputSchema>;

export const FinalizeUploadResponseSchema = z.object({
  material: MaterialListItemSchema,
  jobId: z.string(),
});
export type FinalizeUploadResponse = z.infer<typeof FinalizeUploadResponseSchema>;

export const UpdateMaterialInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Judul materi minimal 1 karakter')
    .max(200, 'Judul materi maksimal 200 karakter'),
});
export type UpdateMaterialInput = z.infer<typeof UpdateMaterialInputSchema>;

export const MaterialListQuerySchema = z.object({
  courseId: z.string().optional(),
  semesterId: z.string().optional(),
  status: MaterialStatusEnum.optional(),
  search: z.string().trim().optional(),
  page: z
    .union([z.number(), z.string()])
    .transform((val) => {
      const p = typeof val === 'number' ? val : parseInt(val, 10);
      return isNaN(p) || p < 1 ? 1 : p;
    })
    .default(1)
    .optional(),
  limit: z
    .union([z.number(), z.string()])
    .transform((val) => {
      const l = typeof val === 'number' ? val : parseInt(val, 10);
      return isNaN(l) || l < 1 ? 20 : l > 100 ? 100 : l;
    })
    .default(20)
    .optional(),
});
export type MaterialListQuery = z.input<typeof MaterialListQuerySchema>;

export const MaterialListResponseSchema = z.object({
  materials: z.array(MaterialListItemSchema),
  pagination: z.object({
    total: numberSchema(),
    page: numberSchema(),
    limit: numberSchema(),
    totalPages: numberSchema(),
  }),
});
function numberSchema() {
  return z.number().int().nonnegative();
}
export type MaterialListResponse = z.infer<typeof MaterialListResponseSchema>;

export const MaterialDownloadResponseSchema = z.object({
  downloadUrl: z.string(),
  expiresInSeconds: z.number().int().positive(),
  expiresAt: z.string().datetime(),
});
export type MaterialDownloadResponse = z.infer<typeof MaterialDownloadResponseSchema>;

export const StorageUsageResponseSchema = z.object({
  usedBytes: z.number().int().nonnegative(),
  limitBytes: z.number().int().positive(),
  percentage: z.number().min(0).max(100),
  dailyUploadsCount: z.number().int().nonnegative(),
  dailyUploadsLimit: z.number().int().positive(),
  dailyResetUtc: z.string(),
  dailyResetUserTimezone: z.string(),
});
export type StorageUsageResponse = z.infer<typeof StorageUsageResponseSchema>;
