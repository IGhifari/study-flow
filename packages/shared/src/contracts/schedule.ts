import { z } from 'zod';
import { CourseSchema } from './course.js';

export const DAY_OF_WEEK = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
  SUNDAY: 7,
} as const;

export const DAY_NAMES_ID: Record<number, string> = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
  7: 'Minggu',
};

export function getDayNameId(dayOfWeek: number): string {
  return DAY_NAMES_ID[dayOfWeek] || `Hari ${dayOfWeek}`;
}

export const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const CourseScheduleConflictSchema = z.object({
  id: z.string(),
  courseId: z.string(),
  courseName: z.string(),
  courseCode: z.string().nullable(),
  dayOfWeek: z.number().int().min(1).max(7),
  startTime: z.string().regex(TIME_REGEX),
  endTime: z.string().regex(TIME_REGEX),
  room: z.string().nullable(),
});
export type CourseScheduleConflict = z.infer<typeof CourseScheduleConflictSchema>;

export const CourseScheduleSchema = z.object({
  id: z.string(),
  userId: z.string(),
  courseId: z.string(),
  dayOfWeek: z.number().int().min(1).max(7),
  startTime: z.string().regex(TIME_REGEX),
  endTime: z.string().regex(TIME_REGEX),
  room: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  course: CourseSchema.pick({
    id: true,
    name: true,
    code: true,
    lecturer: true,
    semesterId: true,
  }).optional(),
  hasConflict: z.boolean().default(false),
  conflicts: z.array(CourseScheduleConflictSchema).optional(),
});
export type CourseSchedule = z.infer<typeof CourseScheduleSchema>;

export const CreateCourseScheduleInputSchema = z
  .object({
    courseId: z.string().min(1, 'Mata kuliah wajib dipilih'),
    dayOfWeek: z
      .number({ message: 'Hari wajib dipilih' })
      .int('Hari harus berupa bilangan bulat')
      .min(1, 'Hari harus antara 1 (Senin) hingga 7 (Minggu)')
      .max(7, 'Hari harus antara 1 (Senin) hingga 7 (Minggu)'),
    startTime: z
      .string({ message: 'Waktu mulai wajib diisi' })
      .regex(TIME_REGEX, 'Format waktu mulai harus berupa HH:mm (contoh: 08:00)'),
    endTime: z
      .string({ message: 'Waktu selesai wajib diisi' })
      .regex(TIME_REGEX, 'Format waktu selesai harus berupa HH:mm (contoh: 09:40)'),
    room: z
      .string()
      .trim()
      .max(100, 'Nama ruangan/lokasi maksimal 100 karakter')
      .optional()
      .nullable()
      .transform((val) => (val && val.length > 0 ? val : null)),
  })
  .superRefine((data, ctx) => {
    if (data.startTime && data.endTime) {
      if (data.startTime === data.endTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Waktu selesai harus lebih besar daripada waktu mulai',
          path: ['endTime'],
        });
      } else if (data.startTime > data.endTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Sesi jadwal lintas tengah malam belum didukung. Harap tentukan waktu mulai dan selesai dalam hari yang sama.',
          path: ['endTime'],
        });
      }
    }
  });
export type CreateCourseScheduleInput = z.input<typeof CreateCourseScheduleInputSchema>;

export const UpdateCourseScheduleInputSchema = z
  .object({
    dayOfWeek: z
      .number()
      .int('Hari harus berupa bilangan bulat')
      .min(1, 'Hari harus antara 1 (Senin) hingga 7 (Minggu)')
      .max(7, 'Hari harus antara 1 (Senin) hingga 7 (Minggu)')
      .optional(),
    startTime: z
      .string()
      .regex(TIME_REGEX, 'Format waktu mulai harus berupa HH:mm (contoh: 08:00)')
      .optional(),
    endTime: z
      .string()
      .regex(TIME_REGEX, 'Format waktu selesai harus berupa HH:mm (contoh: 09:40)')
      .optional(),
    room: z
      .string()
      .trim()
      .max(100, 'Nama ruangan/lokasi maksimal 100 karakter')
      .optional()
      .nullable()
      .transform((val) => (val === undefined ? undefined : val && val.length > 0 ? val : null)),
  })
  .superRefine((data, ctx) => {
    if (data.startTime && data.endTime) {
      if (data.startTime === data.endTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Waktu selesai harus lebih besar daripada waktu mulai',
          path: ['endTime'],
        });
      } else if (data.startTime > data.endTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Sesi jadwal lintas tengah malam belum didukung. Harap tentukan waktu mulai dan selesai dalam hari yang sama.',
          path: ['endTime'],
        });
      }
    }
  });
export type UpdateCourseScheduleInput = z.input<typeof UpdateCourseScheduleInputSchema>;

export const CourseScheduleQuerySchema = z.object({
  semesterId: z.string().optional(),
  courseId: z.string().optional(),
  dayOfWeek: z.coerce.number().int().min(1).max(7).optional(),
});
export type CourseScheduleQuery = z.infer<typeof CourseScheduleQuerySchema>;

export const CourseScheduleResponseSchema = z.object({
  schedule: CourseScheduleSchema,
  hasConflict: z.boolean(),
  conflicts: z.array(CourseScheduleConflictSchema),
  message: z.string().optional(),
});
export type CourseScheduleResponse = z.infer<typeof CourseScheduleResponseSchema>;

export const CourseScheduleListResponseSchema = z.object({
  schedules: z.array(CourseScheduleSchema),
  total: z.number().int(),
});
export type CourseScheduleListResponse = z.infer<typeof CourseScheduleListResponseSchema>;
