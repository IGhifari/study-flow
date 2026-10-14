import { prisma } from '@studyflow/database';
import {
  SetPinResponse,
  PinnedItemsListResponse,
  PinnedItemDetail,
} from '@studyflow/shared';
import { AppError } from '../middleware/errorHandler.js';

export const MAX_PINNED_ITEMS_PER_USER = 20;

/**
 * Explicitly sets pin status for a Material.
 * Idempotent, safe against concurrent requests, enforces max 20 limit.
 * Never modifies Material.updatedAt.
 */
export async function setMaterialPin(
  userId: string,
  materialId: string,
  pinned: boolean
): Promise<SetPinResponse> {
  const material = await prisma.material.findFirst({
    where: { id: materialId, userId },
    include: {
      course: {
        include: { semester: true },
      },
    },
  });

  if (!material || material.deletedAt) {
    const error: AppError = new Error('Materi tidak ditemukan');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (material.course?.archivedAt || material.course?.semester?.archivedAt) {
    const error: AppError = new Error(
      'Item tidak dapat disematkan karena mata kuliah atau semester telah diarsipkan'
    );
    error.statusCode = 400;
    error.code = 'ITEM_ARCHIVED';
    throw error;
  }

  return await prisma.$transaction(async (tx) => {
    // Acquire row-level lock on user to serialize concurrent pinning operations
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;

    const existingPin = await tx.pinnedItem.findUnique({
      where: {
        userId_materialId: { userId, materialId },
      },
    });

    if (pinned) {
      if (existingPin) {
        return {
          success: true,
          pinned: true,
          pinnedAt: existingPin.createdAt.toISOString(),
        };
      }

      const count = await tx.pinnedItem.count({
        where: { userId },
      });

      if (count >= MAX_PINNED_ITEMS_PER_USER) {
        const error: AppError = new Error(
          `Batas maksimal item yang disematkan adalah ${MAX_PINNED_ITEMS_PER_USER} item`
        );
        error.statusCode = 400;
        error.code = 'PIN_LIMIT_EXCEEDED';
        throw error;
      }

      const newPin = await tx.pinnedItem.create({
        data: {
          userId,
          type: 'MATERIAL',
          materialId,
        },
      });

      return {
        success: true,
        pinned: true,
        pinnedAt: newPin.createdAt.toISOString(),
      };
    } else {
      if (!existingPin) {
        return {
          success: true,
          pinned: false,
          pinnedAt: null,
        };
      }

      await tx.pinnedItem.delete({
        where: { id: existingPin.id },
      });

      return {
        success: true,
        pinned: false,
        pinnedAt: null,
      };
    }
  });
}

/**
 * Explicitly sets pin status for a Note.
 * Idempotent, safe against concurrent requests, enforces max 20 limit.
 * Never modifies Note.updatedAt.
 */
export async function setNotePin(
  userId: string,
  noteId: string,
  pinned: boolean
): Promise<SetPinResponse> {
  const note = await prisma.note.findFirst({
    where: { id: noteId, userId },
    include: {
      course: {
        include: { semester: true },
      },
    },
  });

  if (!note) {
    const error: AppError = new Error('Catatan tidak ditemukan');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (note.course?.archivedAt || note.course?.semester?.archivedAt) {
    const error: AppError = new Error(
      'Item tidak dapat disematkan karena mata kuliah atau semester telah diarsipkan'
    );
    error.statusCode = 400;
    error.code = 'ITEM_ARCHIVED';
    throw error;
  }

  return await prisma.$transaction(async (tx) => {
    // Acquire row-level lock on user to serialize concurrent pinning operations
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;

    const existingPin = await tx.pinnedItem.findUnique({
      where: {
        userId_noteId: { userId, noteId },
      },
    });

    if (pinned) {
      if (existingPin) {
        return {
          success: true,
          pinned: true,
          pinnedAt: existingPin.createdAt.toISOString(),
        };
      }

      const count = await tx.pinnedItem.count({
        where: { userId },
      });

      if (count >= MAX_PINNED_ITEMS_PER_USER) {
        const error: AppError = new Error(
          `Batas maksimal item yang disematkan adalah ${MAX_PINNED_ITEMS_PER_USER} item`
        );
        error.statusCode = 400;
        error.code = 'PIN_LIMIT_EXCEEDED';
        throw error;
      }

      const newPin = await tx.pinnedItem.create({
        data: {
          userId,
          type: 'NOTE',
          noteId,
        },
      });

      return {
        success: true,
        pinned: true,
        pinnedAt: newPin.createdAt.toISOString(),
      };
    } else {
      if (!existingPin) {
        return {
          success: true,
          pinned: false,
          pinnedAt: null,
        };
      }

      await tx.pinnedItem.delete({
        where: { id: existingPin.id },
      });

      return {
        success: true,
        pinned: false,
        pinnedAt: null,
      };
    }
  });
}

/**
 * Retrieves pinned items for user, sorted by most recently pinned with deterministic tie-breaker.
 * Filters by semester if specified (materials in semester, notes in semester or general notes).
 * Excludes deleted/archived items.
 */
export async function getPinnedItems(
  userId: string,
  semesterId?: string
): Promise<PinnedItemsListResponse> {
  if (semesterId) {
    const semester = await prisma.semester.findFirst({
      where: { id: semesterId, userId },
    });
    if (!semester || semester.archivedAt) {
      return { items: [], total: 0 };
    }
  }

  const rawPinned = await prisma.pinnedItem.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    include: {
      material: {
        include: {
          course: {
            include: { semester: true },
          },
        },
      },
      note: {
        include: {
          course: {
            include: { semester: true },
          },
        },
      },
    },
  });

  const items: PinnedItemDetail[] = [];

  for (const pin of rawPinned) {
    if (pin.type === 'MATERIAL') {
      if (!pin.material || pin.material.deletedAt) continue;
      const course = pin.material.course;
      const semester = course?.semester;
      if (course?.archivedAt || semester?.archivedAt) continue;

      if (semesterId && course?.semesterId !== semesterId) {
        continue;
      }

      items.push({
        id: pin.id,
        type: 'MATERIAL',
        targetId: pin.material.id,
        title: pin.material.title,
        courseId: course?.id ?? null,
        courseName: course?.name ?? null,
        semesterId: course?.semesterId ?? null,
        semesterName: semester?.name ?? null,
        isGeneralNote: false,
        pinnedAt: pin.createdAt.toISOString(),
        materialStatus: pin.material.status,
        pageCount: pin.material.pageCount,
      });
    } else if (pin.type === 'NOTE') {
      if (!pin.note) continue;
      const course = pin.note.course;
      const semester = course?.semester;
      if (course?.archivedAt || semester?.archivedAt) continue;

      const isGeneral = !course || !course.semesterId;
      if (semesterId && !isGeneral && course?.semesterId !== semesterId) {
        continue;
      }

      items.push({
        id: pin.id,
        type: 'NOTE',
        targetId: pin.note.id,
        title: pin.note.title,
        courseId: course?.id ?? null,
        courseName: course?.name ?? null,
        semesterId: course?.semesterId ?? null,
        semesterName: semester?.name ?? null,
        isGeneralNote: isGeneral,
        pinnedAt: pin.createdAt.toISOString(),
      });
    }
  }

  return {
    items,
    total: items.length,
  };
}
