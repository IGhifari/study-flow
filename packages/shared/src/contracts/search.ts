import { z } from 'zod';

export const SearchResultTypeSchema = z.enum([
  'COURSE',
  'MATERIAL',
  'ASSIGNMENT',
  'NOTE',
]);
export type SearchResultType = z.infer<typeof SearchResultTypeSchema>;

export const SearchQuerySchema = z.object({
  q: z
    .string({ required_error: 'Kata kunci pencarian wajib diisi' })
    .trim()
    .min(2, 'Kata kunci pencarian minimal 2 karakter')
    .max(100, 'Kata kunci pencarian maksimal 100 karakter'),
  semesterId: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(10).default(5),
});
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export const SearchResultItemSchema = z.object({
  id: z.string(),
  type: SearchResultTypeSchema,
  title: z.string(),
  subtitle: z.string().optional(),
  courseId: z.string().nullable().optional(),
  courseName: z.string().nullable().optional(),
  semesterId: z.string(),
  semesterName: z.string(),
  url: z.string(),
  metadata: z
    .object({
      code: z.string().nullable().optional(),
      dueDate: z.string().nullable().optional(),
      priority: z.string().nullable().optional(),
      status: z.string().nullable().optional(),
      isOverdue: z.boolean().optional(),
    })
    .optional(),
});
export type SearchResultItem = z.infer<typeof SearchResultItemSchema>;

export const SearchResponseSchema = z.object({
  query: z.string(),
  semesterScope: z.object({
    id: z.string(),
    name: z.string(),
    isActive: z.boolean().optional(),
  }),
  results: z.object({
    courses: z.array(SearchResultItemSchema),
    materials: z.array(SearchResultItemSchema),
    assignments: z.array(SearchResultItemSchema),
    notes: z.array(SearchResultItemSchema),
  }),
  totalCount: z.number().int().min(0),
  hasMore: z.object({
    courses: z.boolean(),
    materials: z.boolean(),
    assignments: z.boolean(),
    notes: z.boolean(),
  }),
  limitPerCategory: z.number().int(),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
