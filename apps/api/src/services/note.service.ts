import { prisma } from '@studyflow/database';
import {
  Note,
  CreateNoteInput,
  UpdateNoteInput,
  NoteListQuery,
} from '@studyflow/shared';
import { AppError } from '../middleware/errorHandler.js';

interface RawNoteWithCourse {
  id: string;
  userId: string;
  courseId: string;
  title: string;
  content?: string;
  version: number;
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

function toNoteResponse(raw: RawNoteWithCourse, includeContent = true): Note {
  return {
    id: raw.id,
    userId: raw.userId,
    courseId: raw.courseId,
    title: raw.title,
    ...(includeContent && raw.content !== undefined ? { content: raw.content } : {}),
    version: raw.version,
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
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
  };
}

export async function listNotes(
  userId: string,
  query: NoteListQuery
): Promise<{
  notes: Note[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}> {
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

  if (query.search) {
    where.title = {
      contains: query.search,
      mode: 'insensitive',
    };
  }

  const page = typeof query.page === 'number' ? query.page : query.page ? parseInt(String(query.page), 10) || 1 : 1;
  const limit = typeof query.limit === 'number' ? query.limit : query.limit ? parseInt(String(query.limit), 10) || 20 : 20;
  const skip = (page - 1) * limit;

  const [total, rawNotes] = await Promise.all([
    prisma.note.count({ where }),
    prisma.note.findMany({
      where,
      select: {
        id: true,
        userId: true,
        courseId: true,
        title: true,
        version: true,
        createdAt: true,
        updatedAt: true,
        course: {
          include: {
            semester: true,
          },
        },
      },
      orderBy: [
        { updatedAt: 'desc' },
        { id: 'asc' },
      ],
      skip,
      take: limit,
    }),
  ]);

  return {
    notes: (rawNotes as any).map((n: any) => toNoteResponse(n, false)),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getNoteById(userId: string, id: string): Promise<Note> {
  const note = await prisma.note.findFirst({
    where: { id, userId },
    include: {
      course: {
        include: {
          semester: true,
        },
      },
    },
  });

  if (!note) {
    const error: AppError = new Error('Catatan tidak ditemukan');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  return toNoteResponse(note);
}

export async function createNote(
  userId: string,
  input: CreateNoteInput
): Promise<Note> {
  // 1. Verify course ownership & status
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
    const error: AppError = new Error('Catatan tidak dapat ditambahkan pada mata kuliah yang diarsipkan');
    error.statusCode = 400;
    error.code = 'COURSE_ARCHIVED';
    throw error;
  }

  if (course.semester.archivedAt !== null) {
    const error: AppError = new Error('Catatan tidak dapat ditambahkan pada semester yang diarsipkan');
    error.statusCode = 400;
    error.code = 'SEMESTER_ARCHIVED';
    throw error;
  }

  const created = await prisma.note.create({
    data: {
      userId,
      courseId: input.courseId,
      title: input.title,
      content: input.content || '',
      version: 1,
    },
    include: {
      course: {
        include: {
          semester: true,
        },
      },
    },
  });

  return toNoteResponse(created);
}

export async function updateNote(
  userId: string,
  id: string,
  input: UpdateNoteInput & { courseId?: string }
): Promise<Note> {
  // Reject courseId mutation
  if (input.courseId !== undefined) {
    const error: AppError = new Error('Pemindahan mata kuliah catatan belum didukung pada versi ini');
    error.statusCode = 400;
    error.code = 'CANNOT_CHANGE_COURSE';
    throw error;
  }

  const existing = await prisma.note.findFirst({
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
    const error: AppError = new Error('Catatan tidak ditemukan');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  // Read-only invariant on archived Course or Semester
  if (existing.course.archivedAt !== null) {
    const error: AppError = new Error(
      'Catatan pada mata kuliah yang diarsipkan bersifat hanya-baca. Pulihkan mata kuliah terlebih dahulu.'
    );
    error.statusCode = 400;
    error.code = 'COURSE_ARCHIVED';
    throw error;
  }

  if (existing.course.semester.archivedAt !== null) {
    const error: AppError = new Error(
      'Catatan pada semester yang diarsipkan bersifat hanya-baca. Pulihkan semester terlebih dahulu.'
    );
    error.statusCode = 400;
    error.code = 'SEMESTER_ARCHIVED';
    throw error;
  }

  // Optimistic concurrency control check
  if (input.version !== existing.version) {
    const error: AppError = new Error(
      'Catatan telah diperbarui dari sesi atau tab lain. Silakan muat ulang atau periksa perubahan terbaru agar tidak menimpa pekerjaan Anda.'
    );
    error.statusCode = 409;
    error.code = 'NOTE_VERSION_CONFLICT';
    throw error;
  }

  const dataToUpdate: any = {
    version: existing.version + 1,
  };

  if (input.title !== undefined) {
    dataToUpdate.title = input.title;
  }

  if (input.content !== undefined) {
    dataToUpdate.content = input.content;
  }

  const updated = await prisma.note.update({
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

  return toNoteResponse(updated);
}

export async function deleteNote(userId: string, id: string): Promise<void> {
  const existing = await prisma.note.findFirst({
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
    const error: AppError = new Error('Catatan tidak ditemukan');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (existing.course.archivedAt !== null) {
    const error: AppError = new Error(
      'Catatan pada mata kuliah yang diarsipkan bersifat hanya-baca dan tidak dapat dihapus.'
    );
    error.statusCode = 400;
    error.code = 'COURSE_ARCHIVED';
    throw error;
  }

  if (existing.course.semester.archivedAt !== null) {
    const error: AppError = new Error(
      'Catatan pada semester yang diarsipkan bersifat hanya-baca dan tidak dapat dihapus.'
    );
    error.statusCode = 400;
    error.code = 'SEMESTER_ARCHIVED';
    throw error;
  }

  await prisma.note.delete({
    where: { id },
  });
}
