import { prisma, Prisma } from '@studyflow/database';
import {
  CourseSchedule,
  CourseScheduleConflict,
  CreateCourseScheduleInput,
  UpdateCourseScheduleInput,
  CourseScheduleQuery,
  CourseScheduleResponse,
  CourseScheduleListResponse,
} from '@studyflow/shared';
import { AppError } from '../middleware/errorHandler.js';

export function toCourseScheduleResponse(
  record: {
    id: string;
    userId: string;
    courseId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room: string | null;
    createdAt: Date;
    updatedAt: Date;
    course?: {
      id: string;
      name: string;
      code: string | null;
      lecturer: string | null;
      semesterId: string;
    } | null;
  },
  conflicts: CourseScheduleConflict[] = []
): CourseSchedule {
  return {
    id: record.id,
    userId: record.userId,
    courseId: record.courseId,
    dayOfWeek: record.dayOfWeek,
    startTime: record.startTime,
    endTime: record.endTime,
    room: record.room,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    course: record.course
      ? {
          id: record.course.id,
          name: record.course.name,
          code: record.course.code,
          lecturer: record.course.lecturer,
          semesterId: record.course.semesterId,
        }
      : undefined,
    hasConflict: conflicts.length > 0,
    conflicts: conflicts.length > 0 ? conflicts : undefined,
  };
}

/**
 * Mencari konflik waktu dalam semester yang sama dan hari yang sama milik pengguna.
 * Dua sesi bertabrakan jika: (sessionA.startTime < sessionB.endTime) && (sessionA.endTime > sessionB.startTime).
 * Sesi berdampingan (misal 09:00-10:00 dan 10:00-11:00) TIDAK bertabrakan.
 */
export async function findScheduleConflicts(
  userId: string,
  semesterId: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  excludeScheduleId?: string
): Promise<CourseScheduleConflict[]> {
  const candidateSchedules = await prisma.courseSchedule.findMany({
    where: {
      userId,
      dayOfWeek,
      ...(excludeScheduleId ? { id: { not: excludeScheduleId } } : {}),
      course: {
        semesterId,
        archivedAt: null, // Sesi pada mata kuliah yang diarsipkan tidak dianggap konflik aktif
      },
    },
    include: {
      course: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  });

  const conflicts: CourseScheduleConflict[] = [];

  for (const candidate of candidateSchedules) {
    // Overlap condition: startTime < candidate.endTime && endTime > candidate.startTime
    if (startTime < candidate.endTime && endTime > candidate.startTime) {
      conflicts.push({
        id: candidate.id,
        courseId: candidate.courseId,
        courseName: candidate.course.name,
        courseCode: candidate.course.code,
        dayOfWeek: candidate.dayOfWeek,
        startTime: candidate.startTime,
        endTime: candidate.endTime,
        room: candidate.room,
      });
    }
  }

  return conflicts;
}

export async function createSchedule(
  userId: string,
  input: CreateCourseScheduleInput
): Promise<CourseScheduleResponse> {
  // 1. Verifikasi kepemilikan mata kuliah & relasi semester
  const course = await prisma.course.findFirst({
    where: { id: input.courseId, userId },
    include: { semester: true },
  });

  if (!course) {
    const error: AppError = new Error('Mata kuliah tidak ditemukan');
    error.statusCode = 404;
    error.code = 'COURSE_NOT_FOUND';
    throw error;
  }

  // 2. Cegah modifikasi pada mata kuliah atau semester yang diarsipkan
  if (course.archivedAt) {
    const error: AppError = new Error(
      'Mata kuliah telah diarsipkan. Jadwal tidak dapat ditambahkan pada mata kuliah yang diarsipkan.'
    );
    error.statusCode = 400;
    error.code = 'COURSE_ARCHIVED';
    throw error;
  }

  if (course.semester.archivedAt) {
    const error: AppError = new Error(
      'Semester telah diarsipkan. Jadwal tidak dapat ditambahkan pada semester yang diarsipkan.'
    );
    error.statusCode = 400;
    error.code = 'SEMESTER_ARCHIVED';
    throw error;
  }

  // 3. Cegah sesi identik untuk mata kuliah yang sama
  const existingIdentical = await prisma.courseSchedule.findUnique({
    where: {
      courseId_dayOfWeek_startTime_endTime: {
        courseId: input.courseId,
        dayOfWeek: input.dayOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
      },
    },
  });

  if (existingIdentical) {
    const error: AppError = new Error('Sesi jadwal yang identik sudah ada untuk mata kuliah ini');
    error.statusCode = 409;
    error.code = 'SCHEDULE_DUPLICATE';
    throw error;
  }

  // 4. Simpan sesi jadwal baru
  const created = await prisma.courseSchedule.create({
    data: {
      userId,
      courseId: input.courseId,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      room: input.room ?? null,
    },
    include: {
      course: {
        select: {
          id: true,
          name: true,
          code: true,
          lecturer: true,
          semesterId: true,
        },
      },
    },
  });

  // 5. Hitung konflik jadwal (jadwal tetap disimpan meskipun ada konflik)
  const conflicts = await findScheduleConflicts(
    userId,
    course.semesterId,
    input.dayOfWeek,
    input.startTime,
    input.endTime,
    created.id
  );

  return {
    schedule: toCourseScheduleResponse(created, conflicts),
    hasConflict: conflicts.length > 0,
    conflicts,
    message:
      conflicts.length > 0
        ? 'Jadwal berhasil disimpan, namun memiliki benturan waktu dengan jadwal lain.'
        : 'Jadwal berhasil disimpan',
  };
}

export async function listSchedules(
  userId: string,
  query: CourseScheduleQuery
): Promise<CourseScheduleListResponse> {
  const where: Prisma.CourseScheduleWhereInput = {
    userId,
    ...(query.courseId ? { courseId: query.courseId } : {}),
    ...(query.dayOfWeek ? { dayOfWeek: query.dayOfWeek } : {}),
    ...(query.semesterId ? { course: { semesterId: query.semesterId } } : {}),
  };

  const records = await prisma.courseSchedule.findMany({
    where,
    orderBy: [
      { dayOfWeek: 'asc' },
      { startTime: 'asc' },
    ],
    include: {
      course: {
        select: {
          id: true,
          name: true,
          code: true,
          lecturer: true,
          semesterId: true,
        },
      },
    },
  });

  if (records.length === 0) {
    return {
      schedules: [],
      total: 0,
    };
  }

  // Ambil seluruh kandidat jadwal aktif pada semester-semester terkait dalam satu kali query (eliminasi N+1)
  const semesterIds = Array.from(new Set(records.map((r) => r.course.semesterId)));
  const allCandidates = await prisma.courseSchedule.findMany({
    where: {
      userId,
      course: {
        semesterId: { in: semesterIds },
        archivedAt: null,
      },
    },
    include: {
      course: {
        select: {
          id: true,
          name: true,
          code: true,
          semesterId: true,
        },
      },
    },
  });

  // Hitung konflik di memori untuk setiap record secara konsisten
  const schedulesWithConflicts: CourseSchedule[] = records.map((rec) => {
    const conflicts: CourseScheduleConflict[] = [];

    for (const candidate of allCandidates) {
      if (
        candidate.course.semesterId === rec.course.semesterId &&
        candidate.dayOfWeek === rec.dayOfWeek &&
        candidate.id !== rec.id &&
        rec.startTime < candidate.endTime &&
        rec.endTime > candidate.startTime
      ) {
        conflicts.push({
          id: candidate.id,
          courseId: candidate.courseId,
          courseName: candidate.course.name,
          courseCode: candidate.course.code,
          dayOfWeek: candidate.dayOfWeek,
          startTime: candidate.startTime,
          endTime: candidate.endTime,
          room: candidate.room,
        });
      }
    }

    return toCourseScheduleResponse(rec, conflicts);
  });

  return {
    schedules: schedulesWithConflicts,
    total: schedulesWithConflicts.length,
  };
}

export async function getScheduleById(
  userId: string,
  scheduleId: string
): Promise<CourseScheduleResponse> {
  const record = await prisma.courseSchedule.findFirst({
    where: { id: scheduleId, userId },
    include: {
      course: {
        select: {
          id: true,
          name: true,
          code: true,
          lecturer: true,
          semesterId: true,
        },
      },
    },
  });

  if (!record) {
    const error: AppError = new Error('Sesi jadwal tidak ditemukan');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  const conflicts = await findScheduleConflicts(
    userId,
    record.course.semesterId,
    record.dayOfWeek,
    record.startTime,
    record.endTime,
    record.id
  );

  return {
    schedule: toCourseScheduleResponse(record, conflicts),
    hasConflict: conflicts.length > 0,
    conflicts,
  };
}

export async function updateSchedule(
  userId: string,
  scheduleId: string,
  input: UpdateCourseScheduleInput
): Promise<CourseScheduleResponse> {
  const existing = await prisma.courseSchedule.findFirst({
    where: { id: scheduleId, userId },
    include: {
      course: {
        include: { semester: true },
      },
    },
  });

  if (!existing) {
    const error: AppError = new Error('Sesi jadwal tidak ditemukan');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (existing.course.archivedAt) {
    const error: AppError = new Error(
      'Mata kuliah telah diarsipkan. Jadwal pada mata kuliah yang diarsipkan tidak dapat diubah.'
    );
    error.statusCode = 400;
    error.code = 'COURSE_ARCHIVED';
    throw error;
  }

  if (existing.course.semester.archivedAt) {
    const error: AppError = new Error(
      'Semester telah diarsipkan. Jadwal pada semester yang diarsipkan tidak dapat diubah.'
    );
    error.statusCode = 400;
    error.code = 'SEMESTER_ARCHIVED';
    throw error;
  }

  const targetDay = input.dayOfWeek ?? existing.dayOfWeek;
  const targetStartTime = input.startTime ?? existing.startTime;
  const targetEndTime = input.endTime ?? existing.endTime;
  const targetRoom = input.room !== undefined ? input.room : existing.room;

  // Validasi waktu jika salah satu atau keduanya berubah
  if (targetStartTime === targetEndTime) {
    const error: AppError = new Error('Waktu selesai harus lebih besar daripada waktu mulai');
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  if (targetStartTime > targetEndTime) {
    const error: AppError = new Error(
      'Sesi jadwal lintas tengah malam belum didukung. Harap tentukan waktu mulai dan selesai dalam hari yang sama.'
    );
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  // Cek duplikasi identik terhadap sesi lain di mata kuliah yang sama
  if (
    targetDay !== existing.dayOfWeek ||
    targetStartTime !== existing.startTime ||
    targetEndTime !== existing.endTime
  ) {
    const duplicate = await prisma.courseSchedule.findFirst({
      where: {
        courseId: existing.courseId,
        dayOfWeek: targetDay,
        startTime: targetStartTime,
        endTime: targetEndTime,
        id: { not: scheduleId },
      },
    });

    if (duplicate) {
      const error: AppError = new Error('Sesi jadwal yang identik sudah ada untuk mata kuliah ini');
      error.statusCode = 409;
      error.code = 'SCHEDULE_DUPLICATE';
      throw error;
    }
  }

  const updated = await prisma.courseSchedule.update({
    where: { id: scheduleId },
    data: {
      dayOfWeek: targetDay,
      startTime: targetStartTime,
      endTime: targetEndTime,
      room: targetRoom,
    },
    include: {
      course: {
        select: {
          id: true,
          name: true,
          code: true,
          lecturer: true,
          semesterId: true,
        },
      },
    },
  });

  const conflicts = await findScheduleConflicts(
    userId,
    existing.course.semesterId,
    targetDay,
    targetStartTime,
    targetEndTime,
    scheduleId
  );

  return {
    schedule: toCourseScheduleResponse(updated, conflicts),
    hasConflict: conflicts.length > 0,
    conflicts,
    message:
      conflicts.length > 0
        ? 'Jadwal berhasil diperbarui, namun memiliki benturan waktu dengan jadwal lain.'
        : 'Jadwal berhasil diperbarui',
  };
}

export async function deleteSchedule(
  userId: string,
  scheduleId: string
): Promise<{ success: boolean; message: string }> {
  const existing = await prisma.courseSchedule.findFirst({
    where: { id: scheduleId, userId },
    include: {
      course: {
        include: { semester: true },
      },
    },
  });

  if (!existing) {
    const error: AppError = new Error('Sesi jadwal tidak ditemukan');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (existing.course.archivedAt) {
    const error: AppError = new Error(
      'Mata kuliah telah diarsipkan. Jadwal pada mata kuliah yang diarsipkan tidak dapat dihapus.'
    );
    error.statusCode = 400;
    error.code = 'COURSE_ARCHIVED';
    throw error;
  }

  if (existing.course.semester.archivedAt) {
    const error: AppError = new Error(
      'Semester telah diarsipkan. Jadwal pada semester yang diarsipkan tidak dapat dihapus.'
    );
    error.statusCode = 400;
    error.code = 'SEMESTER_ARCHIVED';
    throw error;
  }

  await prisma.courseSchedule.delete({
    where: { id: scheduleId },
  });

  return {
    success: true,
    message: 'Sesi jadwal berhasil dihapus',
  };
}
