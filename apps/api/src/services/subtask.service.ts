import { prisma } from '@studyflow/database';
import {
  AssignmentSubtask,
  CreateSubtaskInput,
  UpdateSubtaskInput,
} from '@studyflow/shared';
import { AppError } from '../middleware/errorHandler.js';

function toSubtaskResponse(raw: {
  id: string;
  assignmentId: string;
  title: string;
  isCompleted: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}): AssignmentSubtask {
  return {
    id: raw.id,
    assignmentId: raw.assignmentId,
    title: raw.title,
    completed: raw.isCompleted,
    order: raw.order,
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
  };
}

export async function getSubtasks(
  userId: string,
  assignmentId: string
): Promise<AssignmentSubtask[]> {
  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, userId },
  });

  if (!assignment) {
    const error: AppError = new Error('Tugas tidak ditemukan');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  const subtasks = await prisma.assignmentSubtask.findMany({
    where: { assignmentId },
    orderBy: [
      { order: 'asc' },
      { createdAt: 'asc' },
      { id: 'asc' },
    ],
  });

  return subtasks.map(toSubtaskResponse);
}

export async function createSubtask(
  userId: string,
  assignmentId: string,
  input: CreateSubtaskInput
): Promise<AssignmentSubtask> {
  const trimmedTitle = input.title?.trim();
  if (!trimmedTitle || trimmedTitle.length < 1) {
    const error: AppError = new Error('Judul subtugas wajib diisi');
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  if (trimmedTitle.length > 200) {
    const error: AppError = new Error('Judul subtugas maksimal 200 karakter');
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Lock the parent assignment row to serialize concurrent writes and prevent exceeding 50 items
    const rows = await tx.$queryRaw<
      Array<{ id: string; user_id: string; status: string; course_id: string }>
    >`SELECT id, user_id, status, course_id FROM assignments WHERE id = ${assignmentId} FOR UPDATE`;

    const assignmentRow = rows[0];
    if (!assignmentRow || assignmentRow.user_id !== userId) {
      const error: AppError = new Error('Tugas tidak ditemukan');
      error.statusCode = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    // 2. Completed parent task invariant: read-only
    if (assignmentRow.status === 'DONE') {
      const error: AppError = new Error(
        'Tugas telah selesai. Buka kembali tugas untuk mengedit subtugas.'
      );
      error.statusCode = 400;
      error.code = 'ASSIGNMENT_COMPLETED';
      throw error;
    }

    // 3. Archived Course/Semester invariant
    const course = await tx.course.findFirst({
      where: { id: assignmentRow.course_id },
      include: { semester: true },
    });

    if (!course) {
      const error: AppError = new Error('Mata kuliah tidak ditemukan');
      error.statusCode = 404;
      error.code = 'COURSE_NOT_FOUND';
      throw error;
    }

    if (course.archivedAt !== null) {
      const error: AppError = new Error(
        'Tugas pada mata kuliah yang diarsipkan bersifat hanya-baca.'
      );
      error.statusCode = 400;
      error.code = 'COURSE_ARCHIVED';
      throw error;
    }

    if (course.semester.archivedAt !== null) {
      const error: AppError = new Error(
        'Tugas pada semester yang diarsipkan bersifat hanya-baca.'
      );
      error.statusCode = 400;
      error.code = 'SEMESTER_ARCHIVED';
      throw error;
    }

    // 4. Max 50 subtasks per assignment limit
    const count = await tx.assignmentSubtask.count({
      where: { assignmentId },
    });

    if (count >= 50) {
      const error: AppError = new Error(
        'Batas maksimal subtugas per tugas adalah 50 subtugas'
      );
      error.statusCode = 400;
      error.code = 'SUBTASK_LIMIT_EXCEEDED';
      throw error;
    }

    // 5. Stable order calculation
    const lastSubtask = await tx.assignmentSubtask.findFirst({
      where: { assignmentId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const nextOrder = (lastSubtask?.order ?? -1) + 1;

    // 6. Create subtask
    const created = await tx.assignmentSubtask.create({
      data: {
        assignmentId,
        title: trimmedTitle,
        order: nextOrder,
        isCompleted: false,
      },
    });

    return toSubtaskResponse(created);
  });
}

export async function updateSubtask(
  userId: string,
  assignmentId: string,
  subtaskId: string,
  input: UpdateSubtaskInput
): Promise<AssignmentSubtask> {
  const trimmedTitle = input.title !== undefined ? input.title.trim() : undefined;
  if (trimmedTitle !== undefined) {
    if (trimmedTitle.length < 1) {
      const error: AppError = new Error('Judul subtugas wajib diisi');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
    if (trimmedTitle.length > 200) {
      const error: AppError = new Error('Judul subtugas maksimal 200 karakter');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Lock the parent assignment
    const rows = await tx.$queryRaw<
      Array<{ id: string; user_id: string; status: string; course_id: string }>
    >`SELECT id, user_id, status, course_id FROM assignments WHERE id = ${assignmentId} FOR UPDATE`;

    const assignmentRow = rows[0];
    if (!assignmentRow || assignmentRow.user_id !== userId) {
      const error: AppError = new Error('Tugas tidak ditemukan');
      error.statusCode = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    // 2. Reject mutation if assignment is DONE
    if (assignmentRow.status === 'DONE') {
      const error: AppError = new Error(
        'Tugas telah selesai. Buka kembali tugas untuk mengedit subtugas.'
      );
      error.statusCode = 400;
      error.code = 'ASSIGNMENT_COMPLETED';
      throw error;
    }

    // 3. Archived Course/Semester invariant
    const course = await tx.course.findFirst({
      where: { id: assignmentRow.course_id },
      include: { semester: true },
    });

    if (!course || course.archivedAt !== null) {
      const error: AppError = new Error(
        'Tugas pada mata kuliah yang diarsipkan bersifat hanya-baca.'
      );
      error.statusCode = 400;
      error.code = 'COURSE_ARCHIVED';
      throw error;
    }

    if (course.semester.archivedAt !== null) {
      const error: AppError = new Error(
        'Tugas pada semester yang diarsipkan bersifat hanya-baca.'
      );
      error.statusCode = 400;
      error.code = 'SEMESTER_ARCHIVED';
      throw error;
    }

    // 4. Verify subtask belongs to this assignment
    const existing = await tx.assignmentSubtask.findFirst({
      where: { id: subtaskId, assignmentId },
    });

    if (!existing) {
      const error: AppError = new Error('Subtugas tidak ditemukan');
      error.statusCode = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    const data: { title?: string; isCompleted?: boolean } = {};
    if (trimmedTitle !== undefined) {
      data.title = trimmedTitle;
    }
    if (input.completed !== undefined) {
      data.isCompleted = input.completed;
    }

    const updated = await tx.assignmentSubtask.update({
      where: { id: subtaskId },
      data,
    });

    return toSubtaskResponse(updated);
  });
}

export async function deleteSubtask(
  userId: string,
  assignmentId: string,
  subtaskId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // 1. Lock parent assignment
    const rows = await tx.$queryRaw<
      Array<{ id: string; user_id: string; status: string; course_id: string }>
    >`SELECT id, user_id, status, course_id FROM assignments WHERE id = ${assignmentId} FOR UPDATE`;

    const assignmentRow = rows[0];
    if (!assignmentRow || assignmentRow.user_id !== userId) {
      const error: AppError = new Error('Tugas tidak ditemukan');
      error.statusCode = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    // 2. Reject deletion if assignment is DONE
    if (assignmentRow.status === 'DONE') {
      const error: AppError = new Error(
        'Tugas telah selesai. Buka kembali tugas untuk mengedit subtugas.'
      );
      error.statusCode = 400;
      error.code = 'ASSIGNMENT_COMPLETED';
      throw error;
    }

    // 3. Archived checks
    const course = await tx.course.findFirst({
      where: { id: assignmentRow.course_id },
      include: { semester: true },
    });

    if (!course || course.archivedAt !== null) {
      const error: AppError = new Error(
        'Tugas pada mata kuliah yang diarsipkan bersifat hanya-baca.'
      );
      error.statusCode = 400;
      error.code = 'COURSE_ARCHIVED';
      throw error;
    }

    if (course.semester.archivedAt !== null) {
      const error: AppError = new Error(
        'Tugas pada semester yang diarsipkan bersifat hanya-baca.'
      );
      error.statusCode = 400;
      error.code = 'SEMESTER_ARCHIVED';
      throw error;
    }

    // 4. Verify subtask belongs to this assignment
    const existing = await tx.assignmentSubtask.findFirst({
      where: { id: subtaskId, assignmentId },
    });

    if (!existing) {
      const error: AppError = new Error('Subtugas tidak ditemukan');
      error.statusCode = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    await tx.assignmentSubtask.delete({
      where: { id: subtaskId },
    });
  });
}
