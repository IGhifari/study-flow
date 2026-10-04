import { z } from 'zod';

export const SemesterSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  academicYear: z.string(),
  isActive: z.boolean(),
  archivedAt: z.string().datetime().nullable(),
  courseCount: z.number().int().nonnegative().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Semester = z.infer<typeof SemesterSchema>;

export const CreateSemesterInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Nama semester minimal 2 karakter')
    .max(100, 'Nama semester maksimal 100 karakter'),
  academicYear: z
    .string()
    .trim()
    .min(4, 'Tahun ajaran minimal 4 karakter (contoh: 2026/2027)')
    .max(20, 'Tahun ajaran maksimal 20 karakter'),
  makeActive: z.boolean().optional(),
});
export type CreateSemesterInput = z.infer<typeof CreateSemesterInputSchema>;

export const UpdateSemesterInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Nama semester minimal 2 karakter')
    .max(100, 'Nama semester maksimal 100 karakter')
    .optional(),
  academicYear: z
    .string()
    .trim()
    .min(4, 'Tahun ajaran minimal 4 karakter (contoh: 2026/2027)')
    .max(20, 'Tahun ajaran maksimal 20 karakter')
    .optional(),
}).refine((data) => data.name !== undefined || data.academicYear !== undefined, {
  message: 'Minimal satu field (nama atau tahun ajaran) harus disertakan',
});
export type UpdateSemesterInput = z.infer<typeof UpdateSemesterInputSchema>;

export const SemesterListQuerySchema = z.object({
  status: z.enum(['active', 'archived', 'all']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type SemesterListQuery = z.infer<typeof SemesterListQuerySchema>;

export const SemesterResponseSchema = z.object({
  semester: SemesterSchema,
  message: z.string().optional(),
});
export type SemesterResponse = z.infer<typeof SemesterResponseSchema>;

export const SemesterListResponseSchema = z.object({
  semesters: z.array(SemesterSchema),
  activeSemesterId: z.string().nullable(),
  pagination: z.object({
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
});
export type SemesterListResponse = z.infer<typeof SemesterListResponseSchema>;
