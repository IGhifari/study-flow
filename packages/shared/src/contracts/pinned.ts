import { z } from 'zod';

export const PinnedItemTypeSchema = z.enum(['MATERIAL', 'NOTE']);
export type PinnedItemType = z.infer<typeof PinnedItemTypeSchema>;

export const SetPinInputSchema = z.object({
  pinned: z.boolean({ required_error: 'Status pinned wajib diisi' }),
});
export type SetPinInput = z.infer<typeof SetPinInputSchema>;

export const SetPinResponseSchema = z.object({
  success: z.boolean(),
  pinned: z.boolean(),
  pinnedAt: z.string().nullable().optional(),
});
export type SetPinResponse = z.infer<typeof SetPinResponseSchema>;

export const PinnedItemDetailSchema = z.object({
  id: z.string(),
  type: PinnedItemTypeSchema,
  targetId: z.string(),
  title: z.string(),
  courseId: z.string().nullable().optional(),
  courseName: z.string().nullable().optional(),
  semesterId: z.string().nullable().optional(),
  semesterName: z.string().nullable().optional(),
  isGeneralNote: z.boolean().optional(),
  pinnedAt: z.string(),
  materialStatus: z.string().nullable().optional(),
  pageCount: z.number().nullable().optional(),
});
export type PinnedItemDetail = z.infer<typeof PinnedItemDetailSchema>;

export const PinnedItemsListResponseSchema = z.object({
  items: z.array(PinnedItemDetailSchema),
  total: z.number(),
});
export type PinnedItemsListResponse = z.infer<typeof PinnedItemsListResponseSchema>;
