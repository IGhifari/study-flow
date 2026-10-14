import { z } from 'zod';
import { CourseSchema } from './course.js';
import { SubtaskCountSchema } from './subtask.js';

export const AssignmentPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export type AssignmentPriority = z.infer<typeof AssignmentPriorityEnum>;

export const AssignmentStatusEnum = z.enum(['TODO', 'IN_PROGRESS', 'DONE']);
export type AssignmentStatus = z.infer<typeof AssignmentStatusEnum>;

export const AssignmentSchema = z.object({
  id: z.string(),
  userId: z.string(),
  courseId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  dueDate: z.string().datetime(),
  priority: AssignmentPriorityEnum,
  status: AssignmentStatusEnum,
  completedAt: z.string().datetime().nullable(),
  firstCompletedAt: z.string().datetime().nullable().optional(),
  isOverdue: z.boolean(),
  course: CourseSchema.optional(),
  subtaskCount: SubtaskCountSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Assignment = z.infer<typeof AssignmentSchema>;

export const CreateAssignmentInputSchema = z.object({
  courseId: z.string().min(1, 'Mata kuliah wajib dipilih'),
  title: z
    .string()
    .trim()
    .min(2, 'Judul tugas minimal 2 karakter')
    .max(200, 'Judul tugas maksimal 200 karakter'),
  description: z
    .string()
    .trim()
    .max(2000, 'Deskripsi maksimal 2000 karakter')
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  dueDate: z.string().min(1, 'Batas waktu (deadline) wajib diisi'),
  priority: AssignmentPriorityEnum.default('MEDIUM').optional(),
  status: AssignmentStatusEnum.default('TODO').optional(),
});
export type CreateAssignmentInput = z.input<typeof CreateAssignmentInputSchema>;

export const UpdateAssignmentInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'Judul tugas minimal 2 karakter')
    .max(200, 'Judul tugas maksimal 200 karakter')
    .optional(),
  description: z
    .string()
    .trim()
    .max(2000, 'Deskripsi maksimal 2000 karakter')
    .optional()
    .nullable()
    .transform((val) => (val === undefined ? undefined : val && val.length > 0 ? val : null)),
  dueDate: z.string().min(1, 'Batas waktu (deadline) wajib diisi').optional(),
  priority: AssignmentPriorityEnum.optional(),
  status: AssignmentStatusEnum.optional(),
});
export type UpdateAssignmentInput = z.input<typeof UpdateAssignmentInputSchema>;

export const AssignmentListQuerySchema = z.object({
  semesterId: z.string().optional(),
  courseId: z.string().optional(),
  status: z.enum(['ALL', 'TODO', 'IN_PROGRESS', 'DONE']).default('ALL').optional(),
  priority: z.enum(['ALL', 'LOW', 'MEDIUM', 'HIGH']).default('ALL').optional(),
  isOverdue: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((val) => val === true || val === 'true')
    .optional(),
  search: z.string().trim().optional(),
  sortBy: z.enum(['dueDate', 'priority', 'createdAt', 'title']).default('dueDate').optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc').optional(),
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
export type AssignmentListQuery = z.input<typeof AssignmentListQuerySchema>;
