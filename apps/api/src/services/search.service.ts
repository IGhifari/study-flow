import { prisma, Prisma } from '@studyflow/database';
import {
  SearchQuery,
  SearchResponse,
  SearchResultItem,
} from '@studyflow/shared';
import { AppError } from '../middleware/errorHandler.js';

function getRank(
  title: string,
  secondary: string | null | undefined,
  queryLower: string
): number {
  const t = title.toLowerCase();
  const s = secondary ? secondary.toLowerCase() : '';

  // 1. Kecocokan persis
  if (t === queryLower || s === queryLower) return 1;
  // 2. Awalan (prefix)
  if (t.startsWith(queryLower) || (s && s.startsWith(queryLower))) return 2;
  // 3. Kecocokan sebagian
  return 3;
}

function sortSearchResults<T extends { id: string; title: string; secondary?: string | null }>(
  items: T[],
  queryLower: string
): T[] {
  return items.sort((a, b) => {
    const rankA = getRank(a.title, a.secondary, queryLower);
    const rankB = getRank(b.title, b.secondary, queryLower);
    if (rankA !== rankB) return rankA - rankB;

    const cmpTitle = a.title.localeCompare(b.title);
    if (cmpTitle !== 0) return cmpTitle;

    return a.id.localeCompare(b.id);
  });
}

export async function searchGlobal(
  userId: string,
  query: SearchQuery
): Promise<SearchResponse> {
  const trimmedQuery = query.q.trim();
  if (trimmedQuery.length < 2) {
    const error: AppError = new Error('Kata kunci pencarian minimal 2 karakter');
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  if (trimmedQuery.length > 100) {
    const error: AppError = new Error('Kata kunci pencarian maksimal 100 karakter');
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  const queryLower = trimmedQuery.toLowerCase();
  const limitPerCategory = query.limit || 5;

  // 1. Resolusi cakupan semester
  let semesterScope: { id: string; name: string; isActive?: boolean };

  if (query.semesterId === 'all') {
    semesterScope = { id: 'all', name: 'Semua Semester' };
  } else if (query.semesterId) {
    const semester = await prisma.semester.findFirst({
      where: { id: query.semesterId, userId },
    });
    if (!semester) {
      const error: AppError = new Error('Semester tidak ditemukan');
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
    semesterScope = {
      id: semester.id,
      name: semester.name,
      isActive: semester.isActive,
    };
  } else {
    // Default: semester aktif milik pengguna
    const activeSemester = await prisma.semester.findFirst({
      where: { userId, isActive: true },
    });
    if (activeSemester) {
      semesterScope = {
        id: activeSemester.id,
        name: activeSemester.name,
        isActive: true,
      };
    } else {
      // Jika tidak ada yang aktif, cari yang terbaru yang tidak diarsipkan
      const latestSemester = await prisma.semester.findFirst({
        where: { userId, archivedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      if (latestSemester) {
        semesterScope = {
          id: latestSemester.id,
          name: latestSemester.name,
          isActive: false,
        };
      } else {
        semesterScope = { id: 'all', name: 'Semua Semester' };
      }
    }
  }

  const isAllSemesters = semesterScope.id === 'all';

  // 2. Query Courses (Mata Kuliah)
  const courseWhere: Prisma.CourseWhereInput = {
    userId,
    archivedAt: null,
    ...(isAllSemesters
      ? { semester: { archivedAt: null } }
      : { semesterId: semesterScope.id }),
    OR: [
      { name: { contains: trimmedQuery, mode: 'insensitive' } },
      { code: { contains: trimmedQuery, mode: 'insensitive' } },
    ],
  };

  const [coursesRaw, courseCount] = await Promise.all([
    prisma.course.findMany({
      where: courseWhere,
      select: {
        id: true,
        name: true,
        code: true,
        semesterId: true,
        semester: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      take: limitPerCategory * 2,
    }),
    prisma.course.count({ where: courseWhere }),
  ]);

  const sortedCourses = sortSearchResults(
    coursesRaw.map((c) => ({
      id: c.id,
      title: c.name,
      secondary: c.code,
      raw: c,
    })),
    queryLower
  ).slice(0, limitPerCategory);

  const courseResults: SearchResultItem[] = sortedCourses.map(({ raw }) => ({
    id: raw.id,
    type: 'COURSE',
    title: raw.name,
    subtitle: raw.code
      ? `${raw.code} • ${raw.semester.name}`
      : raw.semester.name,
    courseId: raw.id,
    courseName: raw.name,
    semesterId: raw.semesterId,
    semesterName: raw.semester.name,
    url: `/courses/${raw.id}`,
    metadata: {
      code: raw.code,
    },
  }));

  // 3. Query Materials (Materi)
  const materialWhere: Prisma.MaterialWhereInput = {
    userId,
    deletedAt: null,
    course: {
      archivedAt: null,
      ...(isAllSemesters
        ? { semester: { archivedAt: null } }
        : { semesterId: semesterScope.id }),
    },
    title: { contains: trimmedQuery, mode: 'insensitive' },
  };

  const [materialsRaw, materialCount] = await Promise.all([
    prisma.material.findMany({
      where: materialWhere,
      select: {
        id: true,
        title: true,
        courseId: true,
        course: {
          select: {
            id: true,
            name: true,
            code: true,
            semesterId: true,
            semester: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      take: limitPerCategory * 2,
    }),
    prisma.material.count({ where: materialWhere }),
  ]);

  const sortedMaterials = sortSearchResults(
    materialsRaw.map((m) => ({
      id: m.id,
      title: m.title,
      secondary: null,
      raw: m,
    })),
    queryLower
  ).slice(0, limitPerCategory);

  const materialResults: SearchResultItem[] = sortedMaterials.map(({ raw }) => ({
    id: raw.id,
    type: 'MATERIAL',
    title: raw.title,
    subtitle: `${raw.course.name} • ${raw.course.semester.name}`,
    courseId: raw.courseId,
    courseName: raw.course.name,
    semesterId: raw.course.semesterId,
    semesterName: raw.course.semester.name,
    url: `/materials/${raw.id}`,
    metadata: {
      code: raw.course.code,
    },
  }));

  // 4. Query Assignments (Tugas)
  const assignmentWhere: Prisma.AssignmentWhereInput = {
    userId,
    course: {
      archivedAt: null,
      ...(isAllSemesters
        ? { semester: { archivedAt: null } }
        : { semesterId: semesterScope.id }),
    },
    title: { contains: trimmedQuery, mode: 'insensitive' },
  };

  const [assignmentsRaw, assignmentCount] = await Promise.all([
    prisma.assignment.findMany({
      where: assignmentWhere,
      select: {
        id: true,
        title: true,
        dueDate: true,
        priority: true,
        status: true,
        courseId: true,
        course: {
          select: {
            id: true,
            name: true,
            code: true,
            semesterId: true,
            semester: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      take: limitPerCategory * 2,
    }),
    prisma.assignment.count({ where: assignmentWhere }),
  ]);

  const now = Date.now();
  const sortedAssignments = sortSearchResults(
    assignmentsRaw.map((a) => ({
      id: a.id,
      title: a.title,
      secondary: null,
      raw: a,
    })),
    queryLower
  ).slice(0, limitPerCategory);

  const assignmentResults: SearchResultItem[] = sortedAssignments.map(({ raw }) => {
    const isOverdue = raw.status !== 'DONE' && raw.dueDate.getTime() < now;
    return {
      id: raw.id,
      type: 'ASSIGNMENT',
      title: raw.title,
      subtitle: `${raw.course.name} • ${raw.course.semester.name}`,
      courseId: raw.courseId,
      courseName: raw.course.name,
      semesterId: raw.course.semesterId,
      semesterName: raw.course.semester.name,
      url: `/assignments?courseId=${raw.courseId}`,
      metadata: {
        code: raw.course.code,
        dueDate: raw.dueDate.toISOString(),
        priority: raw.priority,
        status: raw.status,
        isOverdue,
      },
    };
  });

  // 5. Query Notes (Catatan) - Mencari HANYA title tanpa mengambil content
  const noteWhere: Prisma.NoteWhereInput = {
    userId,
    course: {
      archivedAt: null,
      ...(isAllSemesters
        ? { semester: { archivedAt: null } }
        : { semesterId: semesterScope.id }),
    },
    title: { contains: trimmedQuery, mode: 'insensitive' },
  };

  const [notesRaw, noteCount] = await Promise.all([
    prisma.note.findMany({
      where: noteWhere,
      select: {
        id: true,
        title: true,
        courseId: true,
        course: {
          select: {
            id: true,
            name: true,
            code: true,
            semesterId: true,
            semester: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      take: limitPerCategory * 2,
    }),
    prisma.note.count({ where: noteWhere }),
  ]);

  const sortedNotes = sortSearchResults(
    notesRaw.map((n) => ({
      id: n.id,
      title: n.title,
      secondary: null,
      raw: n,
    })),
    queryLower
  ).slice(0, limitPerCategory);

  const noteResults: SearchResultItem[] = sortedNotes.map(({ raw }) => ({
    id: raw.id,
    type: 'NOTE',
    title: raw.title,
    subtitle: `${raw.course.name} • ${raw.course.semester.name}`,
    courseId: raw.courseId,
    courseName: raw.course.name,
    semesterId: raw.course.semesterId,
    semesterName: raw.course.semester.name,
    url: `/notes/${raw.id}`,
    metadata: {
      code: raw.course.code,
    },
  }));

  const totalCount =
    courseResults.length +
    materialResults.length +
    assignmentResults.length +
    noteResults.length;

  return {
    query: trimmedQuery,
    semesterScope,
    results: {
      courses: courseResults,
      materials: materialResults,
      assignments: assignmentResults,
      notes: noteResults,
    },
    totalCount,
    hasMore: {
      courses: courseCount > courseResults.length,
      materials: materialCount > materialResults.length,
      assignments: assignmentCount > assignmentResults.length,
      notes: noteCount > noteResults.length,
    },
    limitPerCategory,
  };
}
