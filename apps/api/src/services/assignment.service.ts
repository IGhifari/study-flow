import { prisma } from '@studyflow/database';
import {
  Assignment,
  CreateAssignmentInput,
  UpdateAssignmentInput,
  AssignmentListQuery,
  parseUserDateInput,
} from '@studyflow/shared';
import { AppError } from '../middleware/errorHandler.js';
import { scheduleAssignmentReminder } from './assignmentReminder.service.js';

interface RawAssignmentWithCourse {
  id: string;
  userId: string;
  courseId: string;
  title: string;
  description: string | null;
  dueDate: Date;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  completedAt: Date | null;
  firstCompletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  course?: {
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
  };
}

function toAssignmentResponse(
  raw: RawAssignmentWithCourse,
  subtaskCount?: { total: number; completed: number }
): Assignment {
  const isOverdue = raw.status !== 'DONE' && raw.dueDate.getTime() < Date.now();

  return {
    id: raw.id,
    userId: raw.userId,
    courseId: raw.courseId,
    title: raw.title,
    description: raw.description,
    dueDate: raw.dueDate.toISOString(),
    priority: raw.priority,
    status: raw.status,
    completedAt: raw.completedAt ? raw.completedAt.toISOString() : null,
    firstCompletedAt: raw.firstCompletedAt ? raw.firstCompletedAt.toISOString() : null,
    isOverdue,
    course: raw.course
      ? {
          id: raw.course.id,
          userId: raw.course.userId,
          semesterId: raw.course.semesterId,
          name: raw.course.name,
          code: raw.course.code,
          lecturer: raw.course.lecturer,
          description: raw.course.description,
          archivedAt: raw.course.archivedAt ? raw.course.archivedAt.toISOString() : null,
          createdAt: raw.course.createdAt.toISOString(),
          updatedAt: raw.course.updatedAt.toISOString(),
          semester: raw.course.semester
            ? {
                id: raw.course.semester.id,
                userId: raw.course.semester.userId,
                name: raw.course.semester.name,
                academicYear: raw.course.semester.academicYear,
                isActive: raw.course.semester.isActive,
                archivedAt: raw.course.semester.archivedAt ? raw.course.semester.archivedAt.toISOString() : null,
                createdAt: raw.course.semester.createdAt.toISOString(),
                updatedAt: raw.course.semester.updatedAt.toISOString(),
              }
            : undefined,
        }
      : undefined,
    subtaskCount: subtaskCount || { total: 0, completed: 0 },
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
  };
}

export async function listAssignments(
  userId: string,
  query: AssignmentListQuery
): Promise<{
  assignments: Assignment[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}> {
  const now = new Date();
  const where: any = { userId };

  if (query.courseId) {
    where.courseId = query.courseId;
  }

  if (query.semesterId) {
    where.course = {
      ...(where.course || {}),
      semesterId: query.semesterId,
    };
  }

  if (query.status && query.status !== 'ALL') {
    where.status = query.status;
  }

  if (query.priority && query.priority !== 'ALL') {
    where.priority = query.priority;
  }

  if (query.isOverdue !== undefined) {
    if (query.isOverdue) {
      where.status = { not: 'DONE' };
      where.dueDate = { lt: now };
    } else {
      where.OR = [
        { status: 'DONE' },
        { dueDate: { gte: now } },
      ];
    }
  }

  if (query.search) {
    where.title = {
      contains: query.search,
      mode: 'insensitive',
    };
  }

  const page = typeof query.page === 'number' ? query.page : query.page ? parseInt(String(query.page), 10) || 1 : 1;
  const limit = typeof query.limit === 'number' ? query.limit : query.limit ? parseInt(String(query.limit), 10) || 20 : 20;
  const skip = (page - 1) * limit;

  // Sorting
  const sortBy = query.sortBy || 'dueDate';
  const sortOrder = query.sortOrder || 'asc';
  const orderBy: any[] = [];

  if (sortBy === 'priority') {
    orderBy.push({ priority: sortOrder });
  } else if (sortBy === 'createdAt') {
    orderBy.push({ createdAt: sortOrder });
  } else if (sortBy === 'title') {
    orderBy.push({ title: sortOrder });
  } else {
    // Default dueDate
    orderBy.push({ dueDate: sortOrder });
  }
  // Stable tie breaker
  orderBy.push({ id: 'asc' });

  const [total, rawAssignments] = await Promise.all([
    prisma.assignment.count({ where }),
    prisma.assignment.findMany({
      where,
      include: {
        course: {
          include: {
            semester: true,
          },
        },
      },
      orderBy,
      skip,
      take: limit,
    }),
  ]);

  const assignmentIds = rawAssignments.map((a) => a.id);
  const subtaskCountMap: Record<string, { total: number; completed: number }> = {};

  if (assignmentIds.length > 0) {
    const grouped = await prisma.assignmentSubtask.groupBy({
      by: ['assignmentId', 'isCompleted'],
      where: { assignmentId: { in: assignmentIds } },
      _count: { _all: true },
    });

    for (const item of grouped) {
      const current = subtaskCountMap[item.assignmentId] || { total: 0, completed: 0 };
      current.total += item._count._all;
      if (item.isCompleted) {
        current.completed += item._count._all;
      }
      subtaskCountMap[item.assignmentId] = current;
    }
  }

  return {
    assignments: rawAssignments.map((a) =>
      toAssignmentResponse(a, subtaskCountMap[a.id])
    ),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getAssignmentById(userId: string, id: string): Promise<Assignment> {
  const assignment = await prisma.assignment.findFirst({
    where: { id, userId },
    include: {
      course: {
        include: {
          semester: true,
        },
      },
    },
  });

  if (!assignment) {
    const error: AppError = new Error('Tugas tidak ditemukan');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  const grouped = await prisma.assignmentSubtask.groupBy({
    by: ['assignmentId', 'isCompleted'],
    where: { assignmentId: id },
    _count: { _all: true },
  });
  const subtaskCount = { total: 0, completed: 0 };
  for (const item of grouped) {
    subtaskCount.total += item._count._all;
    if (item.isCompleted) {
      subtaskCount.completed += item._count._all;
    }
  }

  return toAssignmentResponse(assignment, subtaskCount);
}

export async function createAssignment(
  userId: string,
  input: CreateAssignmentInput
): Promise<Assignment> {
  // 1. Verify user and timezone
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const timezone = user?.timezone || 'Asia/Jakarta';

  // 2. Parse due date in user's profile timezone context
  let dueDateUtc: Date;
  try {
    dueDateUtc = parseUserDateInput(input.dueDate, { timezone, defaultToEndOfDay: true });
  } catch (err: any) {
    const error: AppError = new Error(err.message || 'Tenggat waktu tidak valid');
    error.statusCode = 400;
    error.code = 'INVALID_DUE_DATE';
    throw error;
  }

  // 3. Verify course ownership & status
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

  if (course.archivedAt !== null) {
    const error: AppError = new Error('Tugas tidak dapat ditambahkan pada mata kuliah yang diarsipkan');
    error.statusCode = 400;
    error.code = 'COURSE_ARCHIVED';
    throw error;
  }

  if (course.semester.archivedAt !== null) {
    const error: AppError = new Error('Tugas tidak dapat ditambahkan pada semester yang diarsipkan');
    error.statusCode = 400;
    error.code = 'SEMESTER_ARCHIVED';
    throw error;
  }

  const status = input.status || 'TODO';
  const completedAt = status === 'DONE' ? new Date() : null;
  const firstCompletedAt = status === 'DONE' ? completedAt : null;

  const created = await prisma.assignment.create({
    data: {
      userId,
      courseId: input.courseId,
      title: input.title,
      description: input.description,
      dueDate: dueDateUtc,
      priority: input.priority || 'MEDIUM',
      status,
      completedAt,
      firstCompletedAt,
    },
    include: {
      course: {
        include: {
          semester: true,
        },
      },
    },
  });

  // Schedule H-1 deadline reminder in BullMQ
  scheduleAssignmentReminder(created).catch(() => {});

  return toAssignmentResponse(created);
}

export async function updateAssignment(
  userId: string,
  id: string,
  input: UpdateAssignmentInput & { courseId?: string }
): Promise<Assignment> {
  // Reject courseId mutation
  if (input.courseId !== undefined) {
    const error: AppError = new Error('Pemindahan mata kuliah tugas belum didukung pada versi ini');
    error.statusCode = 400;
    error.code = 'CANNOT_CHANGE_COURSE';
    throw error;
  }

  const existing = await prisma.assignment.findFirst({
    where: { id, userId },
    include: {
      course: {
        include: {
          semester: true,
        },
      },
    },
  });

  if (!existing) {
    const error: AppError = new Error('Tugas tidak ditemukan');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  // Read-only invariant on archived Course or Semester
  if (existing.course.archivedAt !== null) {
    const error: AppError = new Error(
      'Tugas pada mata kuliah yang diarsipkan bersifat hanya-baca. Pulihkan mata kuliah terlebih dahulu.'
    );
    error.statusCode = 400;
    error.code = 'COURSE_ARCHIVED';
    throw error;
  }

  if (existing.course.semester.archivedAt !== null) {
    const error: AppError = new Error(
      'Tugas pada semester yang diarsipkan bersifat hanya-baca. Pulihkan semester terlebih dahulu.'
    );
    error.statusCode = 400;
    error.code = 'SEMESTER_ARCHIVED';
    throw error;
  }

  const dataToUpdate: any = {};

  if (input.title !== undefined) {
    dataToUpdate.title = input.title;
  }

  if (input.description !== undefined) {
    dataToUpdate.description = input.description;
  }

  if (input.dueDate !== undefined) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    const timezone = user?.timezone || 'Asia/Jakarta';
    try {
      dataToUpdate.dueDate = parseUserDateInput(input.dueDate, { timezone, defaultToEndOfDay: true });
    } catch (err: any) {
      const error: AppError = new Error(err.message || 'Tenggat waktu tidak valid');
      error.statusCode = 400;
      error.code = 'INVALID_DUE_DATE';
      throw error;
    }
  }

  if (input.priority !== undefined) {
    dataToUpdate.priority = input.priority;
  }

  if (input.status !== undefined) {
    dataToUpdate.status = input.status;
    if (input.status === 'DONE') {
      // Preserve completedAt if already DONE, otherwise set to server now
      const completedTime =
        existing.status === 'DONE' && existing.completedAt ? existing.completedAt : new Date();
      dataToUpdate.completedAt = completedTime;
      // Record firstCompletedAt if not set yet (atomic rule: maximum 1 count on first completion)
      if (!existing.firstCompletedAt) {
        dataToUpdate.firstCompletedAt = completedTime;
      }
    } else {
      // Transition from DONE to TODO/IN_PROGRESS clears completedAt
      dataToUpdate.completedAt = null;
      // firstCompletedAt is intentionally preserved so reopening does not erase or duplicate history
    }
  }

  const updated = await prisma.assignment.update({
    where: { id },
    data: dataToUpdate,
    include: {
      course: {
        include: {
          semester: true,
        },
      },
    },
  });

  // Re-schedule H-1 deadline reminder in BullMQ if updated
  scheduleAssignmentReminder(updated).catch(() => {});

  const grouped = await prisma.assignmentSubtask.groupBy({
    by: ['assignmentId', 'isCompleted'],
    where: { assignmentId: id },
    _count: { _all: true },
  });
  const subtaskCount = { total: 0, completed: 0 };
  for (const item of grouped) {
    subtaskCount.total += item._count._all;
    if (item.isCompleted) {
      subtaskCount.completed += item._count._all;
    }
  }

  return toAssignmentResponse(updated, subtaskCount);
}

export async function deleteAssignment(userId: string, id: string): Promise<void> {
  const existing = await prisma.assignment.findFirst({
    where: { id, userId },
    include: {
      course: {
        include: {
          semester: true,
        },
      },
    },
  });

  if (!existing) {
    const error: AppError = new Error('Tugas tidak ditemukan');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (existing.course.archivedAt !== null) {
    const error: AppError = new Error(
      'Tugas pada mata kuliah yang diarsipkan bersifat hanya-baca dan tidak dapat dihapus.'
    );
    error.statusCode = 400;
    error.code = 'COURSE_ARCHIVED';
    throw error;
  }

  if (existing.course.semester.archivedAt !== null) {
    const error: AppError = new Error(
      'Tugas pada semester yang diarsipkan bersifat hanya-baca dan tidak dapat dihapus.'
    );
    error.statusCode = 400;
    error.code = 'SEMESTER_ARCHIVED';
    throw error;
  }

  await prisma.assignment.delete({
    where: { id },
  });
}
