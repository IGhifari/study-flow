import { z } from 'zod';
import { SemesterSchema } from './semester.js';

export const CourseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  semesterId: z.string(),
  name: z.string(),
  code: z.string().nullable(),
  lecturer: z.string().nullable(),
  description: z.string().nullable(),
  archivedAt: z.string().datetime().nullable(),
  semester: SemesterSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Course = z.infer<typeof CourseSchema>;

export const CreateCourseInputSchema = z.object({
  semesterId: z.string().min(1, 'Semester wajib dipilih'),
  name: z
    .string()
    .trim()
    .min(2, 'Nama mata kuliah minimal 2 karakter')
    .max(150, 'Nama mata kuliah maksimal 150 karakter'),
  code: z
    .string()
    .trim()
    .max(30, 'Kode mata kuliah maksimal 30 karakter')
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  lecturer: z
    .string()
    .trim()
    .max(100, 'Nama dosen pengampu maksimal 100 karakter')
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  description: z
    .string()
    .trim()
    .max(1000, 'Deskripsi maksimal 1000 karakter')
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
});
export type CreateCourseInput = z.input<typeof CreateCourseInputSchema>;

export const UpdateCourseInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Nama mata kuliah minimal 2 karakter')
    .max(150, 'Nama mata kuliah maksimal 150 karakter')
    .optional(),
  code: z
    .string()
    .trim()
    .max(30, 'Kode mata kuliah maksimal 30 karakter')
    .optional()
    .nullable()
    .transform((val) => (val === undefined ? undefined : val && val.length > 0 ? val : null)),
  lecturer: z
    .string()
    .trim()
    .max(100, 'Nama dosen pengampu maksimal 100 karakter')
    .optional()
    .nullable()
    .transform((val) => (val === undefined ? undefined : val && val.length > 0 ? val : null)),
  description: z
    .string()
    .trim()
    .max(1000, 'Deskripsi maksimal 1000 karakter')
    .optional()
    .nullable()
    .transform((val) => (val === undefined ? undefined : val && val.length > 0 ? val : null)),
  semesterId: z.string().optional(), // Disallowed in business logic; if provided and changed, backend rejects!
});
export type UpdateCourseInput = z.input<typeof UpdateCourseInputSchema>;

export const CourseListQuerySchema = z.object({
  semesterId: z.string().optional(),
  status: z.enum(['active', 'archived', 'all']).default('all'),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type CourseListQuery = z.input<typeof CourseListQuerySchema>;

export const CourseResponseSchema = z.object({
  course: CourseSchema,
  message: z.string().optional(),
});
export type CourseResponse = z.infer<typeof CourseResponseSchema>;

export const CourseListResponseSchema = z.object({
  courses: z.array(CourseSchema),
  pagination: z.object({
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
});
export type CourseListResponse = z.infer<typeof CourseListResponseSchema>;
