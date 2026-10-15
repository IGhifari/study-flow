import { z } from 'zod';

export const RoleEnum = z.enum(['USER', 'ADMIN']);
export type Role = z.infer<typeof RoleEnum>;

export const AdminLoginInputSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});
export type AdminLoginInput = z.infer<typeof AdminLoginInputSchema>;

export const AdminSummarySchema = z.object({
  totalUsers: z.number().int().nonnegative(),
  totalMaterials: z.number().int().nonnegative(),
  totalAssignments: z.number().int().nonnegative(),
  failedJobs24h: z.number().int().nonnegative(),
  calculatedAt: z.string().datetime(),
});
export type AdminSummary = z.infer<typeof AdminSummarySchema>;

export const AdminUserListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: RoleEnum,
  emailVerifiedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type AdminUserListItem = z.infer<typeof AdminUserListItemSchema>;

export const AdminUserListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  sortBy: z.enum(['createdAt', 'name', 'email']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type AdminUserListQuery = z.infer<typeof AdminUserListQuerySchema>;

export const AdminUserListResponseSchema = z.object({
  items: z.array(AdminUserListItemSchema),
  pagination: z.object({
    page: z.number().int(),
    limit: z.number().int(),
    totalItems: z.number().int(),
    totalPages: z.number().int(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }),
});
export type AdminUserListResponse = z.infer<typeof AdminUserListResponseSchema>;

export const AdminUserAuthMethodsSchema = z.object({
  hasPassword: z.boolean(),
  hasGoogle: z.boolean(),
  methods: z.array(z.enum(['password', 'google'])),
});
export type AdminUserAuthMethods = z.infer<typeof AdminUserAuthMethodsSchema>;

export const AdminUserUsageSummarySchema = z.object({
  semesters: z.number().int().nonnegative(),
  courses: z.number().int().nonnegative(),
  materials: z.number().int().nonnegative(),
  assignments: z.number().int().nonnegative(),
  notes: z.number().int().nonnegative(),
  storageUsage: z
    .object({
      usedBytes: z.number().nonnegative(),
      formatted: z.string(),
    })
    .nullable(),
});
export type AdminUserUsageSummary = z.infer<typeof AdminUserUsageSummarySchema>;

export const AdminUserDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: RoleEnum,
  timezone: z.string(),
  emailVerifiedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  authMethods: AdminUserAuthMethodsSchema,
  usageSummary: AdminUserUsageSummarySchema,
});
export type AdminUserDetail = z.infer<typeof AdminUserDetailSchema>;

// ==========================================
// Phase 3 — Job & Queue Monitoring Contracts
// ==========================================

export const AdminJobTypeEnum = z.enum([
  'DOCUMENT_EXTRACTION',
  'DOCUMENT_CLEANUP',
  'AI_SUMMARY_GENERATION',
  'AI_FLASHCARD_GENERATION',
  'AI_QUIZ_GENERATION',
]);
export type AdminJobType = z.infer<typeof AdminJobTypeEnum>;

export const AdminJobStatusEnum = z.enum([
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
]);
export type AdminJobStatus = z.infer<typeof AdminJobStatusEnum>;

export const AdminQueueStatusEnum = z.enum([
  'waiting',
  'active',
  'delayed',
  'completed',
  'failed',
  'not_found',
  'unavailable',
]);
export type AdminQueueStatus = z.infer<typeof AdminQueueStatusEnum>;

export const AdminJobListItemSchema = z.object({
  id: z.string(),
  type: AdminJobTypeEnum,
  status: AdminJobStatusEnum,
  userId: z.string(),
  userName: z.string(),
  materialId: z.string().nullable(),
  attempts: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  errorCode: z.string().nullable(),
  safeErrorMessage: z.string().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  failedAt: z.string().datetime().nullable(),
});
export type AdminJobListItem = z.infer<typeof AdminJobListItemSchema>;

export const AdminJobListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: AdminJobTypeEnum.optional(),
  status: AdminJobStatusEnum.optional(),
  userId: z.string().trim().max(100).optional(),
  jobId: z.string().trim().max(100).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortBy: z.enum(['createdAt', 'startedAt', 'completedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type AdminJobListQuery = z.infer<typeof AdminJobListQuerySchema>;

export const AdminJobListResponseSchema = z.object({
  items: z.array(AdminJobListItemSchema),
  pagination: z.object({
    page: z.number().int(),
    limit: z.number().int(),
    totalItems: z.number().int(),
    totalPages: z.number().int(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }),
});
export type AdminJobListResponse = z.infer<typeof AdminJobListResponseSchema>;

export const AdminJobDetailSchema = z.object({
  id: z.string(),
  type: AdminJobTypeEnum,
  status: AdminJobStatusEnum,
  queueStatus: AdminQueueStatusEnum,
  queueName: z.string().nullable(),
  userId: z.string(),
  userName: z.string(),
  materialId: z.string().nullable(),
  attempts: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  errorCode: z.string().nullable(),
  safeErrorMessage: z.string().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  failedAt: z.string().datetime().nullable(),
});
export type AdminJobDetail = z.infer<typeof AdminJobDetailSchema>;

export const AdminQueueCountsSchema = z.object({
  waiting: z.number().int().nonnegative(),
  active: z.number().int().nonnegative(),
  delayed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});
export type AdminQueueCounts = z.infer<typeof AdminQueueCountsSchema>;

export const AdminQueueSummaryItemSchema = z.object({
  name: z.string(),
  label: z.string(),
  status: z.enum(['available', 'unavailable']),
  counts: AdminQueueCountsSchema.nullable(),
  retentionNote: z.string(),
});
export type AdminQueueSummaryItem = z.infer<typeof AdminQueueSummaryItemSchema>;

export const AdminQueuesSummaryResponseSchema = z.object({
  queues: z.array(AdminQueueSummaryItemSchema),
  redisStatus: z.enum(['connected', 'unavailable']),
  retentionNotice: z.string(),
  timestamp: z.string().datetime(),
});
export type AdminQueuesSummaryResponse = z.infer<typeof AdminQueuesSummaryResponseSchema>;

// ==========================================
// Admin Trends & Activity Metrics Contracts
// ==========================================

export const AdminTrendRangeEnum = z.enum(['7d', '30d', '90d']);
export type AdminTrendRange = z.infer<typeof AdminTrendRangeEnum>;

export const AdminTrendDataPointSchema = z.object({
  date: z.string(), // YYYY-MM-DD
  materi: z.number().int().nonnegative(),
  tugas: z.number().int().nonnegative(),
});
export type AdminTrendDataPoint = z.infer<typeof AdminTrendDataPointSchema>;

export const AdminTrendsQuerySchema = z.object({
  range: AdminTrendRangeEnum.default('30d'),
});
export type AdminTrendsQuery = z.infer<typeof AdminTrendsQuerySchema>;

export const AdminTrendsResponseSchema = z.object({
  range: AdminTrendRangeEnum,
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  data: z.array(AdminTrendDataPointSchema),
  totals: z.object({
    materi: z.number().int().nonnegative(),
    tugas: z.number().int().nonnegative(),
  }),
});
export type AdminTrendsResponse = z.infer<typeof AdminTrendsResponseSchema>;

// ==========================================
// Admin System Infrastructure & Health Status
// ==========================================

export const AdminModuleStatusEnum = z.enum([
  'HEALTHY',
  'DEGRADED',
  'UNAVAILABLE',
  'UNCONFIGURED',
]);
export type AdminModuleStatus = z.infer<typeof AdminModuleStatusEnum>;

export const AdminModuleCategoryEnum = z.enum([
  'DATABASE',
  'QUEUE_WORKER',
  'STORAGE',
  'AI_PIPELINE',
  'SECURITY',
]);
export type AdminModuleCategory = z.infer<typeof AdminModuleCategoryEnum>;

export const AdminSystemModuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: AdminModuleCategoryEnum,
  status: AdminModuleStatusEnum,
  engine: z.string(),
  metricLabel: z.string(),
  metricValue: z.string(),
  description: z.string(),
  updatedAt: z.string().datetime(),
  details: z.record(z.unknown()).optional(),
});
export type AdminSystemModule = z.infer<typeof AdminSystemModuleSchema>;

export const AdminSystemStatusResponseSchema = z.object({
  modules: z.array(AdminSystemModuleSchema),
  timestamp: z.string().datetime(),
});
export type AdminSystemStatusResponse = z.infer<typeof AdminSystemStatusResponseSchema>;




