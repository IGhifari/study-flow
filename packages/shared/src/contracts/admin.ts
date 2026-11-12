import { z } from 'zod';
import { TimezoneSchema } from './auth.js';

export const RoleEnum = z.enum(['USER', 'ADMIN']);
export type Role = z.infer<typeof RoleEnum>;

export const AdminLoginInputSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
  turnstileToken: z.string().optional(),
});
export type AdminLoginInput = z.infer<typeof AdminLoginInputSchema>;

export const AdminSummarySchema = z.object({
  totalUsers: z.number().int().nonnegative(),
  totalMaterials: z.number().int().nonnegative(),
  totalAssignments: z.number().int().nonnegative(),
  failedJobs24h: z.number().int().nonnegative(),
  calculatedAt: z.string().datetime(),
  totalAdmins: z.number().int().nonnegative().optional(),
  totalCourses: z.number().int().nonnegative().optional(),
  totalStorageBytes: z.number().nonnegative().optional(),
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
  role: RoleEnum.optional(),
  verified: z.enum(['true', 'false']).optional(),
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
  aiQuota: z
    .object({
      dailyGenerationCount: z.number().int().nonnegative(),
      dailyLimit: z.number().int().positive(),
      activeJobsCount: z.number().int().nonnegative(),
    })
    .optional(),
  activeSessionsCount: z.number().int().nonnegative().optional(),
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

export const AdminCreateUserInputSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(100),
  email: z.string().trim().toLowerCase().email('Format email tidak valid'),
  password: z.string().min(12, 'Password minimal 12 karakter').max(128),
  role: RoleEnum.default('USER'),
  timezone: TimezoneSchema.default('Asia/Jakarta'),
  emailVerified: z.boolean().default(true),
});
export type AdminCreateUserInput = z.infer<typeof AdminCreateUserInputSchema>;

export const AdminUpdateUserInputSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  role: RoleEnum.optional(),
  timezone: TimezoneSchema.optional(),
  emailVerified: z.boolean().optional(),
  newPassword: z.string().min(12, 'Password minimal 12 karakter').max(128).optional(),
  resetQuota: z.boolean().optional(),
  revokeSessions: z.boolean().optional(),
});
export type AdminUpdateUserInput = z.infer<typeof AdminUpdateUserInputSchema>;

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
  search: z.string().trim().max(100).optional(),
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
  details: z.record(z.string(), z.unknown()).optional(),
});
export type AdminSystemModule = z.infer<typeof AdminSystemModuleSchema>;

export const AdminSystemStatusResponseSchema = z.object({
  modules: z.array(AdminSystemModuleSchema),
  timestamp: z.string().datetime(),
});
export type AdminSystemStatusResponse = z.infer<typeof AdminSystemStatusResponseSchema>;

// ==========================================
// Admin Academic & User Data Contracts
// ==========================================

export const AdminCourseListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string().nullable(),
  lecturer: z.string().nullable(),
  semesterName: z.string(),
  academicYear: z.string(),
  userId: z.string(),
  userName: z.string(),
  userEmail: z.string(),
  materialsCount: z.number().int().nonnegative(),
  assignmentsCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});
export type AdminCourseListItem = z.infer<typeof AdminCourseListItemSchema>;

export const AdminCourseListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  sortBy: z.enum(['createdAt', 'name', 'code']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type AdminCourseListQuery = z.infer<typeof AdminCourseListQuerySchema>;

export const AdminCourseListResponseSchema = z.object({
  items: z.array(AdminCourseListItemSchema),
  pagination: z.object({
    page: z.number().int(),
    limit: z.number().int(),
    totalItems: z.number().int(),
    totalPages: z.number().int(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }),
});
export type AdminCourseListResponse = z.infer<typeof AdminCourseListResponseSchema>;

export const AdminMaterialStatusEnum = z.enum([
  'UPLOADING',
  'QUEUED',
  'PROCESSING',
  'READY',
  'FAILED',
]);
export type AdminMaterialStatus = z.infer<typeof AdminMaterialStatusEnum>;

export const AdminMaterialListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  originalFilename: z.string(),
  mimeType: z.string().optional(),
  bytes: z.number().int().nonnegative(),
  formattedSize: z.string(),
  pageCount: z.number().int().nullable(),
  status: AdminMaterialStatusEnum,
  errorCode: z.string().nullable().optional(),
  safeErrorMessage: z.string().nullable().optional(),
  userId: z.string(),
  userName: z.string(),
  userEmail: z.string(),
  courseId: z.string(),
  courseName: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AdminMaterialListItem = z.infer<typeof AdminMaterialListItemSchema>;

export const AdminMaterialListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: AdminMaterialStatusEnum.optional(),
  userId: z.string().trim().optional(),
  sortBy: z.enum(['createdAt', 'title', 'bytes']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type AdminMaterialListQuery = z.infer<typeof AdminMaterialListQuerySchema>;

export const AdminMaterialListResponseSchema = z.object({
  items: z.array(AdminMaterialListItemSchema),
  pagination: z.object({
    page: z.number().int(),
    limit: z.number().int(),
    totalItems: z.number().int(),
    totalPages: z.number().int(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }),
});
export type AdminMaterialListResponse = z.infer<typeof AdminMaterialListResponseSchema>;

export const AdminUpdateMaterialInputSchema = z.object({
  title: z.string().trim().min(2, 'Judul minimal 2 karakter').max(200).optional(),
  action: z.enum(['retry']).optional(),
});
export type AdminUpdateMaterialInput = z.infer<typeof AdminUpdateMaterialInputSchema>;

export const AdminAssignmentListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  courseName: z.string(),
  dueDate: z.string().datetime(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']),
  isOverdue: z.boolean(),
  subtasksCount: z.number().int().nonnegative(),
  completedSubtasksCount: z.number().int().nonnegative(),
  userId: z.string(),
  userName: z.string(),
  userEmail: z.string(),
  createdAt: z.string().datetime(),
});
export type AdminAssignmentListItem = z.infer<typeof AdminAssignmentListItemSchema>;

export const AdminAssignmentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  sortBy: z.enum(['createdAt', 'dueDate', 'title']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type AdminAssignmentListQuery = z.infer<typeof AdminAssignmentListQuerySchema>;

export const AdminAssignmentListResponseSchema = z.object({
  items: z.array(AdminAssignmentListItemSchema),
  pagination: z.object({
    page: z.number().int(),
    limit: z.number().int(),
    totalItems: z.number().int(),
    totalPages: z.number().int(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }),
});
export type AdminAssignmentListResponse = z.infer<typeof AdminAssignmentListResponseSchema>;

export const AdminNoteListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  courseName: z.string(),
  materialTitle: z.string().nullable(),
  contentSnippet: z.string(),
  userId: z.string(),
  userName: z.string(),
  userEmail: z.string(),
  updatedAt: z.string().datetime(),
});
export type AdminNoteListItem = z.infer<typeof AdminNoteListItemSchema>;

export const AdminNoteListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  sortBy: z.enum(['updatedAt', 'title']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type AdminNoteListQuery = z.infer<typeof AdminNoteListQuerySchema>;

export const AdminNoteListResponseSchema = z.object({
  items: z.array(AdminNoteListItemSchema),
  pagination: z.object({
    page: z.number().int(),
    limit: z.number().int(),
    totalItems: z.number().int(),
    totalPages: z.number().int(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }),
});
export type AdminNoteListResponse = z.infer<typeof AdminNoteListResponseSchema>;

export const AdminScheduleListItemSchema = z.object({
  id: z.string(),
  courseName: z.string(),
  courseCode: z.string().nullable(),
  dayOfWeek: z.number().int().min(1).max(7),
  startTime: z.string(),
  endTime: z.string(),
  room: z.string().nullable(),
  userId: z.string(),
  userName: z.string(),
  userEmail: z.string(),
});
export type AdminScheduleListItem = z.infer<typeof AdminScheduleListItemSchema>;

export const AdminScheduleListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  dayOfWeek: z.coerce.number().int().min(1).max(7).optional(),
  sortBy: z.enum(['dayOfWeek', 'startTime', 'createdAt']).default('dayOfWeek'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});
export type AdminScheduleListQuery = z.infer<typeof AdminScheduleListQuerySchema>;

export const AdminScheduleListResponseSchema = z.object({
  items: z.array(AdminScheduleListItemSchema),
  pagination: z.object({
    page: z.number().int(),
    limit: z.number().int(),
    totalItems: z.number().int(),
    totalPages: z.number().int(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }),
});
export type AdminScheduleListResponse = z.infer<typeof AdminScheduleListResponseSchema>;

export const AdminQuizListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  materialTitle: z.string(),
  questionCount: z.number().int().nonnegative(),
  status: z.string(),
  attemptsCount: z.number().int().nonnegative(),
  averageScore: z.number().nullable(),
  userId: z.string(),
  userName: z.string(),
  userEmail: z.string(),
  createdAt: z.string().datetime(),
});
export type AdminQuizListItem = z.infer<typeof AdminQuizListItemSchema>;

export const AdminQuizListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: z.string().trim().optional(),
  sortBy: z.enum(['createdAt', 'title', 'questionCount']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type AdminQuizListQuery = z.infer<typeof AdminQuizListQuerySchema>;

export const AdminQuizListResponseSchema = z.object({
  items: z.array(AdminQuizListItemSchema),
  pagination: z.object({
    page: z.number().int(),
    limit: z.number().int(),
    totalItems: z.number().int(),
    totalPages: z.number().int(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }),
});
export type AdminQuizListResponse = z.infer<typeof AdminQuizListResponseSchema>;

// ==========================================
// Admin Background Job Cleanup Contracts
// ==========================================

export const AdminCleanupJobsInputSchema = z.object({
  status: z.enum(['FAILED', 'COMPLETED']).default('FAILED'),
  olderThanDays: z.number().int().min(0).max(365).default(0),
});
export type AdminCleanupJobsInput = z.infer<typeof AdminCleanupJobsInputSchema>;

// ==========================================
// Admin Profile & Security Contracts
// ==========================================

export const AdminUpdateProfileInputSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(100).optional(),
  timezone: z.enum(['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'UTC']).optional(),
});
export type AdminUpdateProfileInput = z.infer<typeof AdminUpdateProfileInputSchema>;

const AdminChangePasswordBaseSchema = z.object({
  currentPassword: z.string().min(1, 'Password saat ini wajib diisi'),
  newPassword: z.string().min(12, 'Password baru minimal 12 karakter').max(128),
});

export const AdminChangePasswordInputSchema = AdminChangePasswordBaseSchema.refine(
  (data) => data.currentPassword !== data.newPassword,
  {
    message: 'Password baru harus berbeda dari password saat ini',
    path: ['newPassword'],
  }
);
export type AdminChangePasswordInput = z.infer<typeof AdminChangePasswordInputSchema>;

export const AdminChangePasswordFormSchema = AdminChangePasswordBaseSchema.extend({
  confirmPassword: z.string().min(1, 'Konfirmasi kata sandi wajib diisi'),
})
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'Password baru harus berbeda dari password saat ini',
    path: ['newPassword'],
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Konfirmasi kata sandi tidak cocok dengan kata sandi baru',
    path: ['confirmPassword'],
  });
export type AdminChangePasswordFormInput = z.infer<typeof AdminChangePasswordFormSchema>;

export const AdminSessionItemSchema = z.object({
  id: z.string(),
  familyId: z.string(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  isCurrent: z.boolean(),
});
export type AdminSessionItem = z.infer<typeof AdminSessionItemSchema>;

export const AdminSessionsResponseSchema = z.object({
  sessions: z.array(AdminSessionItemSchema),
});
export type AdminSessionsResponse = z.infer<typeof AdminSessionsResponseSchema>;





