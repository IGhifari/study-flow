import { prisma, Prisma } from '@studyflow/database';
import {
  Course,
  CreateCourseInput,
  UpdateCourseInput,
  CourseListQuery,
  CourseListResponse,
} from '@studyflow/shared';
import { toSemesterResponse } from './semester.service.js';
import { AppError } from '../middleware/errorHandler.js';

export function toCourseResponse(record: {
  id: string;
  userId: string;
  semesterId: string;
  name: string;
  code: string | null;
  lecturer: string | null;
  description: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  semester?: {
    id: string;
    userId: string;
    name: string;
    academicYear: string;
    isActive: boolean;
    archivedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
}): Course {
  return {
    id: record.id,
    userId: record.userId,
    semesterId: record.semesterId,
    name: record.name,
    code: record.code,
    lecturer: record.lecturer,
    description: record.description,
    archivedAt: record.archivedAt ? record.archivedAt.toISOString() : null,
    semester: record.semester ? toSemesterResponse(record.semester) : undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function listCourses(
  userId: string,
  query: CourseListQuery
): Promise<CourseListResponse> {
  // If specific semesterId is filtered, verify it exists and belongs to user
  if (query.semesterId) {
    const semester = await prisma.semester.findFirst({
      where: { id: query.semesterId, userId },
    });
    if (!semester) {
      const error: AppError = new Error('Semester tidak ditemukan');
      error.statusCode = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }
  }

  const where: Prisma.CourseWhereInput = {
    userId,
    ...(query.semesterId && { semesterId: query.semesterId }),
    ...(query.status === 'active' && { archivedAt: null }),
    ...(query.status === 'archived' && { archivedAt: { not: null } }),
    ...(query.q && {
      OR: [
        { name: { contains: query.q, mode: 'insensitive' } },
        { code: { contains: query.q, mode: 'insensitive' } },
      ],
    }),
  };

  const [total, records] = await Promise.all([
    prisma.course.count({ where }),
    prisma.course.findMany({
      where,
      include: {
        semester: true,
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'asc' }, // stable tie-breaker
      ],
      skip: ((query.page || 1) - 1) * (query.limit || 20),
      take: query.limit || 20,
    }),
  ]);

  const page = query.page || 1;
  const limit = query.limit || 20;

  return {
    courses: records.map(toCourseResponse),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getCourseById(userId: string, id: string): Promise<Course> {
  const record = await prisma.course.findFirst({
    where: { id, userId },
    include: {
      semester: true,
    },
  });

  if (!record) {
    const error: AppError = new Error('Mata kuliah tidak ditemukan');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  return toCourseResponse(record);
}

export async function createCourse(
  userId: string,
  input: CreateCourseInput
): Promise<Course> {
  // Verify target semester belongs to user
  const semester = await prisma.semester.findFirst({
    where: { id: input.semesterId, userId },
  });

  if (!semester) {
    const error: AppError = new Error('Semester tidak ditemukan');
    error.statusCode = 404;
    error.code = 'SEMESTER_NOT_FOUND';
    throw error;
  }

  // Invariant: Cannot add course to an archived semester
  if (semester.archivedAt !== null) {
    const error: AppError = new Error('Mata kuliah tidak dapat ditambahkan pada semester yang diarsipkan');
    error.statusCode = 400;
    error.code = 'SEMESTER_ARCHIVED';
    throw error;
  }

  const created = await prisma.course.create({
    data: {
      userId,
      semesterId: input.semesterId,
      name: input.name,
      code: input.code,
      lecturer: input.lecturer,
      description: input.description,
    },
    include: {
      semester: true,
    },
  });

  return toCourseResponse(created);
}

export async function updateCourse(
  userId: string,
  id: string,
  input: UpdateCourseInput
): Promise<Course> {
  const course = await prisma.course.findFirst({
    where: { id, userId },
  });

  if (!course) {
    const error: AppError = new Error('Mata kuliah tidak ditemukan');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  // Invariant: Changing semester of a course is not supported in this milestone
  if (input.semesterId !== undefined && input.semesterId !== course.semesterId) {
    const error: AppError = new Error('Perubahan semester mata kuliah belum didukung pada versi ini');
    error.statusCode = 400;
    error.code = 'CANNOT_CHANGE_SEMESTER';
    throw error;
  }

  const updated = await prisma.course.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.code !== undefined && { code: input.code }),
      ...(input.lecturer !== undefined && { lecturer: input.lecturer }),
      ...(input.description !== undefined && { description: input.description }),
    },
    include: {
      semester: true,
    },
  });

  return toCourseResponse(updated);
}

export async function archiveCourse(userId: string, id: string): Promise<Course> {
  const course = await prisma.course.findFirst({
    where: { id, userId },
  });

  if (!course) {
    const error: AppError = new Error('Mata kuliah tidak ditemukan');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (course.archivedAt !== null) {
    return toCourseResponse(course);
  }

  const archived = await prisma.course.update({
    where: { id },
    data: {
      archivedAt: new Date(),
    },
    include: {
      semester: true,
    },
  });

  return toCourseResponse(archived);
}

export async function unarchiveCourse(userId: string, id: string): Promise<Course> {
  const course = await prisma.course.findFirst({
    where: { id, userId },
  });

  if (!course) {
    const error: AppError = new Error('Mata kuliah tidak ditemukan');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (course.archivedAt === null) {
    return toCourseResponse(course);
  }

  const unarchived = await prisma.course.update({
    where: { id },
    data: {
      archivedAt: null,
    },
    include: {
      semester: true,
    },
  });

  return toCourseResponse(unarchived);
}

export async function deleteCourse(userId: string, id: string): Promise<void> {
  const course = await prisma.course.findFirst({
    where: { id, userId },
    include: {
      _count: {
        select: {
          assignments: true,
          notes: true,
        },
      },
    },
  });

  if (!course) {
    const error: AppError = new Error('Mata kuliah tidak ditemukan');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (course._count.assignments > 0) {
    const error: AppError = new Error(
      'Mata kuliah tidak dapat dihapus karena masih memiliki tugas. Silakan arsipkan mata kuliah atau hapus tugas di dalamnya terlebih dahulu.'
    );
    error.statusCode = 409;
    error.code = 'COURSE_HAS_ASSIGNMENTS';
    throw error;
  }

  if (course._count.notes > 0) {
    const error: AppError = new Error(
      'Mata kuliah tidak dapat dihapus karena masih memiliki catatan. Silakan arsipkan mata kuliah atau hapus catatan di dalamnya terlebih dahulu.'
    );
    error.statusCode = 409;
    error.code = 'COURSE_HAS_NOTES';
    throw error;
  }

  await prisma.course.delete({
    where: { id },
  });
}
