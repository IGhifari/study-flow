import { z } from 'zod';

export const CalendarEventTypeSchema = z.enum(['SCHEDULE', 'ASSIGNMENT']);
export type CalendarEventType = z.infer<typeof CalendarEventTypeSchema>;

export const CalendarFilterTypeSchema = z.enum(['all', 'schedule', 'assignment']);
export type CalendarFilterType = z.infer<typeof CalendarFilterTypeSchema>;

export const CalendarQuerySchema = z.object({
  semesterId: z.string().optional(),
  courseId: z.string().optional(),
  type: CalendarFilterTypeSchema.default('all'),
  startDate: z.string().min(1, 'Tanggal mulai wajib diisi'),
  endDate: z.string().min(1, 'Tanggal akhir wajib diisi'),
});
export type CalendarQuery = z.infer<typeof CalendarQuerySchema>;

export const CalendarEventSchema = z.object({
  id: z.string(),
  type: CalendarEventTypeSchema,
  title: z.string(),
  courseId: z.string(),
  courseName: z.string(),
  courseCode: z.string().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  // Schedule-specific
  scheduleId: z.string().optional(),
  dayOfWeek: z.number().int().min(1).max(7).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  room: z.string().nullable().optional(),
  lecturer: z.string().nullable().optional(),
  // Assignment-specific
  assignmentId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  dueTime: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
  isOverdue: z.boolean().optional(),
  description: z.string().nullable().optional(),
});
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

export const CalendarResponseSchema = z.object({
  events: z.array(CalendarEventSchema),
  semester: z.object({
    id: z.string(),
    name: z.string(),
    academicYear: z.string(),
    isActive: z.boolean(),
  }),
  range: z.object({
    startDate: z.string(),
    endDate: z.string(),
  }),
  timezone: z.string(),
  disclaimer: z.string().optional(),
});
export type CalendarResponse = z.infer<typeof CalendarResponseSchema>;
