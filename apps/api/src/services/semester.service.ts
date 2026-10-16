import { prisma } from '@studyflow/database';
import {
  Semester,
  CreateSemesterInput,
  UpdateSemesterInput,
  SemesterListQuery,
  SemesterListResponse,
} from '@studyflow/shared';
import { AppError } from '../middleware/errorHandler.js';

export function toSemesterResponse(record: {
  id: string;
  userId: string;
  name: string;
  academicYear: string;
  isActive: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { courses: number };
}): Semester {
  return {
    id: record.id,
    userId: record.userId,
    name: record.name,
    academicYear: record.academicYear,
    isActive: record.isActive,
    archivedAt: record.archivedAt ? record.archivedAt.toISOString() : null,
    courseCount: record._count ? record._count.courses : undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function listSemesters(
  userId: string,
  query: SemesterListQuery
): Promise<SemesterListResponse> {
  const where: {
    userId: string;
    archivedAt?: null | { not: null };
  } = { userId };

  if (query.status === 'active') {
    where.archivedAt = null;
  } else if (query.status === 'archived') {
    where.archivedAt = { not: null };
  }

  const [total, records, activeSemester] = await Promise.all([
    prisma.semester.count({ where }),
    prisma.semester.findMany({
      where,
      include: {
        _count: {
          select: { courses: true },
        },
      },
      orderBy: [
        { isActive: 'desc' },
        { createdAt: 'desc' },
        { id: 'asc' }, // stable tie-breaker
      ],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.semester.findFirst({
      where: { userId, isActive: true },
      select: { id: true },
    }),
  ]);

  return {
    semesters: records.map(toSemesterResponse),
    activeSemesterId: activeSemester?.id || null,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit) || 1,
    },
  };
}

export async function getSemesterById(userId: string, id: string): Promise<Semester> {
  const record = await prisma.semester.findFirst({
    where: { id, userId },
    include: {
      _count: {
        select: { courses: true },
      },
    },
  });

  if (!record) {
    const error: AppError = new Error('Semester tidak ditemukan');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  return toSemesterResponse(record);
}

export async function createSemester(
  userId: string,
  input: CreateSemesterInput
): Promise<Semester> {
  return await prisma.$transaction(async (tx) => {
    // Check if user has any existing semesters
    const existingCount = await tx.semester.count({
      where: { userId },
    });

    // Invariant: First semester created becomes active atomically,
    // or if explicitly requested makeActive
    const shouldBeActive = existingCount === 0 || !!input.makeActive;

    if (shouldBeActive && existingCount > 0) {
      // Deactivate previously active semester
      await tx.semester.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      });
    }

    const created = await tx.semester.create({
      data: {
        userId,
        name: input.name,
        academicYear: input.academicYear,
        isActive: shouldBeActive,
      },
      include: {
        _count: {
          select: { courses: true },
        },
      },
    });

    return toSemesterResponse(created);
  });
}

export async function updateSemester(
  userId: string,
  id: string,
  input: UpdateSemesterInput
): Promise<Semester> {
  const semester = await prisma.semester.findFirst({
    where: { id, userId },
  });

  if (!semester) {
    const error: AppError = new Error('Semester tidak ditemukan');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  const updated = await prisma.semester.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.academicYear !== undefined && { academicYear: input.academicYear }),
    },
    include: {
      _count: {
        select: { courses: true },
      },
    },
  });

  return toSemesterResponse(updated);
}

export async function activateSemester(userId: string, id: string): Promise<Semester> {
  return await prisma.$transaction(async (tx) => {
    const semester = await tx.semester.findFirst({
      where: { id, userId },
    });

    if (!semester) {
      const error: AppError = new Error('Semester tidak ditemukan');
      error.statusCode = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    if (semester.archivedAt !== null) {
      const error: AppError = new Error('Semester arsip tidak dapat diaktifkan sebelum dipulihkan');
      error.statusCode = 400;
      error.code = 'SEMESTER_ARCHIVED';
      throw error;
    }

    // Atomically deactivate current active semester and activate this one
    await tx.semester.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

    const activated = await tx.semester.update({
      where: { id },
      data: { isActive: true },
      include: {
        _count: {
          select: { courses: true },
        },
      },
    });

    return toSemesterResponse(activated);
  });
}

export async function archiveSemester(userId: string, id: string): Promise<Semester> {
  return await prisma.$transaction(async (tx) => {
    const semester = await tx.semester.findFirst({
      where: { id, userId },
    });

    if (!semester) {
      const error: AppError = new Error('Semester tidak ditemukan');
      error.statusCode = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    if (semester.archivedAt !== null) {
      // Already archived
      return toSemesterResponse(semester);
    }

    // Invariant: Archiving an active semester clears active state (isActive becomes false)
    const archived = await tx.semester.update({
      where: { id },
      data: {
        archivedAt: new Date(),
        isActive: false,
      },
      include: {
        _count: {
          select: { courses: true },
        },
      },
    });

    return toSemesterResponse(archived);
  });
}

export async function unarchiveSemester(userId: string, id: string): Promise<Semester> {
  const semester = await prisma.semester.findFirst({
    where: { id, userId },
  });

  if (!semester) {
    const error: AppError = new Error('Semester tidak ditemukan');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (semester.archivedAt === null) {
    return toSemesterResponse(semester);
  }

  // Invariant: Unarchiving does NOT automatically make it active
  const unarchived = await prisma.semester.update({
    where: { id },
    data: {
      archivedAt: null,
    },
    include: {
      _count: {
        select: { courses: true },
      },
    },
  });

  return toSemesterResponse(unarchived);
}

export async function deleteSemester(userId: string, id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const semesterRows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM semesters
      WHERE id = ${id} AND user_id = ${userId}
      FOR UPDATE
    `;

    if (semesterRows.length === 0) {
      const error: AppError = new Error('Semester tidak ditemukan');
      error.statusCode = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    const coursesCount = await tx.course.count({
      where: {
        userId,
        semesterId: id,
      },
    });

    // Invariant: Semester containing courses cannot be deleted
    if (coursesCount > 0) {
      const error: AppError = new Error(
        'Semester tidak dapat dihapus karena masih memiliki mata kuliah. Silakan arsipkan semester atau hapus mata kuliah di dalamnya terlebih dahulu.'
      );
      error.statusCode = 409;
      error.code = 'SEMESTER_HAS_COURSES';
      throw error;
    }

    await tx.semester.delete({
      where: { id },
    });
  });
}

