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
