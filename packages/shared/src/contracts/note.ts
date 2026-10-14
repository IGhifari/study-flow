import { z } from 'zod';
import { CourseSchema } from './course.js';

export const NoteSchema = z.object({
  id: z.string(),
  userId: z.string(),
  courseId: z.string(),
  materialId: z.string().nullable().optional(),
  title: z.string(),
  content: z.string().optional(),
  version: z.number().int().positive(),
  course: CourseSchema.optional(),
  material: z
    .object({
      id: z.string(),
      title: z.string(),
      originalFilename: z.string(),
    })
    .nullable()
    .optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  isPinned: z.boolean().optional(),
});
export type Note = z.infer<typeof NoteSchema>;

export const NoteListItemSchema = NoteSchema.omit({ content: true });
export type NoteListItem = z.infer<typeof NoteListItemSchema>;

export const CreateNoteInputSchema = z.object({
  courseId: z.string().min(1, 'Mata kuliah wajib dipilih'),
  materialId: z.string().nullable().optional(),
  title: z
    .string()
    .trim()
    .min(1, 'Judul catatan minimal 1 karakter')
    .max(150, 'Judul catatan maksimal 150 karakter'),
  content: z
    .string()
    .max(50000, 'Isi catatan maksimal 50.000 karakter')
    .default('')
    .optional(),
});
export type CreateNoteInput = z.input<typeof CreateNoteInputSchema>;

export const UpdateNoteInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Judul catatan minimal 1 karakter')
    .max(150, 'Judul catatan maksimal 150 karakter')
    .optional(),
  content: z
    .string()
    .max(50000, 'Isi catatan maksimal 50.000 karakter')
    .optional(),
  materialId: z.string().nullable().optional(),
  version: z
    .number({ required_error: 'Versi catatan wajib disertakan untuk mencegah konflik' })
    .int()
    .positive(),
});
export type UpdateNoteInput = z.input<typeof UpdateNoteInputSchema>;

export const NoteListQuerySchema = z.object({
  semesterId: z.string().optional(),
  courseId: z.string().optional(),
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
export type NoteListQuery = z.input<typeof NoteListQuerySchema>;
