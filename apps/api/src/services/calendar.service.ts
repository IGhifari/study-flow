import { prisma } from '@studyflow/database';
import {
  CalendarQuery,
  CalendarResponse,
  CalendarEvent,
  getLocalComponents,
  localComponentsToUtc,
  parseUserDateInput,
  isValidTimezone,
} from '@studyflow/shared';
import { AppError } from '../middleware/errorHandler.js';

function parseDateParam(
  dateParam: string,
  timezone: string
): { year: number; month: number; day: number; dateStr: string } {
  const d = parseUserDateInput(dateParam, { timezone, defaultToEndOfDay: false });
  const comp = getLocalComponents(d, timezone);
  const dateStr = `${comp.year}-${String(comp.month).padStart(2, '0')}-${String(comp.day).padStart(2, '0')}`;
  return { year: comp.year, month: comp.month, day: comp.day, dateStr };
}

export async function getCalendarData(
  userId: string,
  query: CalendarQuery
): Promise<CalendarResponse> {
  // 1. Dapatkan user dan timezone
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, timezone: true },
  });

  if (!user) {
    const error: AppError = new Error('Pengguna tidak ditemukan');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  const timezone = isValidTimezone(user.timezone) ? user.timezone : 'Asia/Jakarta';

  // 2. Resolusi semester
  let semester;
  if (query.semesterId) {
    semester = await prisma.semester.findFirst({
      where: { id: query.semesterId, userId },
    });
    if (!semester) {
      const error: AppError = new Error('Semester tidak ditemukan');
      error.statusCode = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }
  } else {
    semester = await prisma.semester.findFirst({
      where: { userId, isActive: true },
    });
    if (!semester) {
      // Jika tidak ada yang aktif, cari semester terbaru yang tidak diarsipkan
      semester = await prisma.semester.findFirst({
        where: { userId, archivedAt: null },
        orderBy: { createdAt: 'desc' },
      });
    }
  }

  if (!semester) {
    const error: AppError = new Error('Belum ada semester yang dibuat');
    error.statusCode = 404;
    error.code = 'SEMESTER_NOT_FOUND';
    throw error;
  }

  if (semester.archivedAt) {
    const error: AppError = new Error('Semester telah diarsipkan');
    error.statusCode = 400;
    error.code = 'SEMESTER_ARCHIVED';
    throw error;
  }

  // 3. Validasi courseId jika diberikan
  if (query.courseId) {
    const course = await prisma.course.findFirst({
      where: {
        id: query.courseId,
        userId,
        semesterId: semester.id,
      },
    });
    if (!course) {
      const error: AppError = new Error('Mata kuliah tidak ditemukan pada semester ini');
      error.statusCode = 404;
      error.code = 'COURSE_NOT_FOUND';
      throw error;
    }
    if (course.archivedAt) {
      const error: AppError = new Error('Mata kuliah telah diarsipkan');
      error.statusCode = 400;
      error.code = 'COURSE_ARCHIVED';
      throw error;
    }
  }

  // 4. Parse dan validasi rentang tanggal [startDate, endDate)
  const startComp = parseDateParam(query.startDate, timezone);
  const endComp = parseDateParam(query.endDate, timezone);

  const startInstant = localComponentsToUtc(
    startComp.year,
    startComp.month,
    startComp.day,
    0,
    0,
    0,
    timezone
  );
  const endInstant = localComponentsToUtc(
    endComp.year,
    endComp.month,
    endComp.day,
    0,
    0,
    0,
    timezone
  );

  if (endInstant.getTime() <= startInstant.getTime()) {
    const error: AppError = new Error('Tanggal akhir harus setelah tanggal mulai');
    error.statusCode = 400;
    error.code = 'INVALID_RANGE';
    throw error;
  }

  const diffDays = Math.round((endInstant.getTime() - startInstant.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays > 60) {
    const error: AppError = new Error('Rentang waktu kalender maksimal 60 hari');
    error.statusCode = 400;
    error.code = 'RANGE_TOO_LARGE';
    throw error;
  }

  const filterType = query.type || 'all';
  const events: CalendarEvent[] = [];

  // 5. Query Jadwal Kuliah & ekspansi mingguan
  if (filterType === 'all' || filterType === 'schedule') {
    const schedules = await prisma.courseSchedule.findMany({
      where: {
        userId,
        ...(query.courseId ? { courseId: query.courseId } : {}),
        course: {
          semesterId: semester.id,
          archivedAt: null,
        },
      },
      include: {
        course: {
          select: {
            id: true,
            name: true,
            code: true,
            lecturer: true,
          },
        },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    // Generate local calendar days
    let cursor = new Date(startInstant.getTime());
    while (cursor.getTime() < endInstant.getTime()) {
      const comp = getLocalComponents(cursor, timezone);
      const dateStr = `${comp.year}-${String(comp.month).padStart(2, '0')}-${String(comp.day).padStart(2, '0')}`;
      const d = new Date(Date.UTC(comp.year, comp.month - 1, comp.day));
      const jsDay = d.getUTCDay();
      const dayOfWeek = jsDay === 0 ? 7 : jsDay;

      // Temukan jadwal pada hari ini
      const matchingSchedules = schedules.filter((s) => s.dayOfWeek === dayOfWeek);
      for (const s of matchingSchedules) {
        events.push({
          id: `${s.id}-${dateStr}`,
          type: 'SCHEDULE',
          title: s.course.name,
          courseId: s.courseId,
          courseName: s.course.name,
          courseCode: s.course.code,
          date: dateStr,
          scheduleId: s.id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          room: s.room,
          lecturer: s.course.lecturer,
        });
      }

      // Maju ke hari berikutnya dengan aman
      const nextNoon =
        localComponentsToUtc(comp.year, comp.month, comp.day, 12, 0, 0, timezone).getTime() +
        24 * 60 * 60 * 1000;
      const nextComp = getLocalComponents(new Date(nextNoon), timezone);
      cursor = localComponentsToUtc(nextComp.year, nextComp.month, nextComp.day, 0, 0, 0, timezone);
    }
  }

  // 6. Query Tugas Kuliah
  if (filterType === 'all' || filterType === 'assignment') {
    const assignments = await prisma.assignment.findMany({
      where: {
        userId,
        dueDate: {
          gte: startInstant,
          lt: endInstant,
        },
        course: {
          semesterId: semester.id,
          archivedAt: null,
          ...(query.courseId ? { id: query.courseId } : {}),
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
      orderBy: { dueDate: 'asc' },
    });

    const now = Date.now();
    for (const a of assignments) {
      const comp = getLocalComponents(a.dueDate, timezone);
      const dateStr = `${comp.year}-${String(comp.month).padStart(2, '0')}-${String(comp.day).padStart(2, '0')}`;
      const timeStr = `${String(comp.hour).padStart(2, '0')}:${String(comp.minute).padStart(2, '0')}`;
      const isOverdue = a.status !== 'DONE' && a.dueDate.getTime() < now;

      events.push({
        id: a.id,
        type: 'ASSIGNMENT',
        title: a.title,
        courseId: a.courseId,
        courseName: a.course.name,
        courseCode: a.course.code,
        date: dateStr,
        assignmentId: a.id,
        dueDate: a.dueDate.toISOString(),
        dueTime: timeStr,
        priority: a.priority,
        status: a.status,
        isOverdue,
        description: a.description,
      });
    }
  }

  // 7. Sort events: date ASC -> time ASC -> title ASC
  events.sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    const timeA = a.type === 'SCHEDULE' ? a.startTime || '' : a.dueTime || '';
    const timeB = b.type === 'SCHEDULE' ? b.startTime || '' : b.dueTime || '';
    if (timeA !== timeB) {
      return timeA.localeCompare(timeB);
    }
    return a.title.localeCompare(b.title);
  });

  return {
    events,
    semester: {
      id: semester.id,
      name: semester.name,
      academicYear: semester.academicYear,
      isActive: semester.isActive,
    },
    range: {
      startDate: startComp.dateStr,
      endDate: endComp.dateStr,
    },
    timezone,
    disclaimer:
      'Jadwal kuliah ditampilkan sebagai pola mingguan berulang. Hari libur dan penyesuaian pertemuan belum diperhitungkan.',
  };
}
