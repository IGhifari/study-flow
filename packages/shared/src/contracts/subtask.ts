import { z } from 'zod';

export const AssignmentSubtaskSchema = z.object({
  id: z.string(),
  assignmentId: z.string(),
  title: z
    .string()
    .trim()
    .min(1, 'Judul subtugas wajib diisi')
    .max(200, 'Judul subtugas maksimal 200 karakter'),
  completed: z.boolean(),
  order: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AssignmentSubtask = z.infer<typeof AssignmentSubtaskSchema>;

export const CreateSubtaskInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Judul subtugas wajib diisi')
    .max(200, 'Judul subtugas maksimal 200 karakter'),
});
export type CreateSubtaskInput = z.infer<typeof CreateSubtaskInputSchema>;

export const UpdateSubtaskInputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Judul subtugas wajib diisi')
      .max(200, 'Judul subtugas maksimal 200 karakter')
      .optional(),
    completed: z.boolean().optional(),
  })
  .refine(
    (data) => data.title !== undefined || data.completed !== undefined,
    {
      message: 'Setidaknya salah satu dari judul atau status selesai harus diisi',
    }
  );
export type UpdateSubtaskInput = z.infer<typeof UpdateSubtaskInputSchema>;

export const SubtaskCountSchema = z.object({
  total: z.number(),
  completed: z.number(),
});
export type SubtaskCount = z.infer<typeof SubtaskCountSchema>;

export const SubtaskListResponseSchema = z.object({
  subtasks: z.array(AssignmentSubtaskSchema),
});
export type SubtaskListResponse = z.infer<typeof SubtaskListResponseSchema>;

export const SubtaskDetailResponseSchema = z.object({
  subtask: AssignmentSubtaskSchema,
});
export type SubtaskDetailResponse = z.infer<typeof SubtaskDetailResponseSchema>;
