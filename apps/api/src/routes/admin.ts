import { Router, Request, Response, NextFunction } from 'express';
import {
  AdminUserListQuerySchema,
  AdminCreateUserInputSchema,
  AdminUpdateUserInputSchema,
  AdminJobListQuerySchema,
  AdminCleanupJobsInputSchema,
  AdminTrendsQuerySchema,
  AdminCourseListQuerySchema,
  AdminMaterialListQuerySchema,
  AdminUpdateMaterialInputSchema,
  AdminAssignmentListQuerySchema,
  AdminNoteListQuerySchema,
  AdminScheduleListQuerySchema,
  AdminQuizListQuerySchema,
} from '@studyflow/shared';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  getAdminSummary,
  listAdminUsers,
  getAdminUserDetail,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  listAdminJobs,
  getAdminJobDetail,
  retryAdminJob,
  deleteAdminJob,
  cleanupAdminJobs,
  getAdminQueuesSummary,
  getAdminTrends,
  getAdminSystemStatus,
  listAdminCourses,
  listAdminMaterials,
  updateAdminMaterial,
  deleteAdminMaterial,
  listAdminAssignments,
  listAdminNotes,
  listAdminSchedules,
  listAdminQuizzes,
} from '../services/admin.service.js';
import { originCheckMiddleware } from '../middleware/originCheck.js';

export const adminRouter = Router();

// Apply CSRF/Origin check to all state-changing endpoints in admin
adminRouter.use(originCheckMiddleware);

// Enforce requireAdmin on all /api/admin routes
adminRouter.use(requireAdmin);

// GET /api/admin/summary
adminRouter.get('/summary', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const summary = await getAdminSummary();
    res.status(200).json(summary);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/users
adminRouter.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = AdminUserListQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Parameter query tidak valid',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const result = await listAdminUsers(parseResult.data);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/users/:id
adminRouter.get('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.id;
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'ID pengguna tidak valid',
        },
      });
      return;
    }

    const detail = await getAdminUserDetail(userId.trim());
    res.setHeader('Cache-Control', 'no-store, private');
    res.status(200).json(detail);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/users
adminRouter.post('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = AdminCreateUserInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Data pembuatan pengguna tidak valid',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const createdUser = await createAdminUser(parseResult.data);
    res.status(201).json({
      message: 'Pengguna berhasil dibuat',
      user: createdUser,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/users/:id
adminRouter.patch('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.id;
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'ID pengguna tidak valid',
        },
      });
      return;
    }

    const parseResult = AdminUpdateUserInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Data pembaruan pengguna tidak valid',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const updatedUser = await updateAdminUser(req.adminUser!.id, userId.trim(), parseResult.data);
    res.status(200).json({
      message: 'Data pengguna berhasil diperbarui',
      user: updatedUser,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/users/:id
adminRouter.delete('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.id;
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'ID pengguna tidak valid',
        },
      });
      return;
    }

    await deleteAdminUser(req.adminUser!.id, userId.trim());
    res.status(200).json({
      message: 'Pengguna berhasil dihapus',
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/jobs/queues/summary (registered before /jobs/:id to avoid parameter shadowing)
adminRouter.get('/jobs/queues/summary', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const summary = await getAdminQueuesSummary();
    res.setHeader('Cache-Control', 'no-store, private');
    res.status(200).json(summary);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/jobs
adminRouter.get('/jobs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = AdminJobListQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Parameter query tidak valid',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const result = await listAdminJobs(parseResult.data);
    res.setHeader('Cache-Control', 'no-store, private');
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/jobs/:id
adminRouter.get('/jobs/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobId = req.params.id;
    if (!jobId || typeof jobId !== 'string' || jobId.trim().length === 0) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'ID pekerjaan tidak valid',
        },
      });
      return;
    }

    const detail = await getAdminJobDetail(jobId.trim());
    res.setHeader('Cache-Control', 'no-store, private');
    res.status(200).json(detail);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/jobs/cleanup (registered before :id to prevent shadow)
adminRouter.post('/jobs/cleanup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = AdminCleanupJobsInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Parameter pembersihan pekerjaan tidak valid',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const result = await cleanupAdminJobs(parseResult.data);
    res.status(200).json({
      message: `Berhasil membersihkan ${result.deletedCount} riwayat pekerjaan`,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/jobs/:id/retry
adminRouter.post('/jobs/:id/retry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobId = req.params.id;
    if (!jobId || typeof jobId !== 'string' || jobId.trim().length === 0) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'ID pekerjaan tidak valid',
        },
      });
      return;
    }

    const result = await retryAdminJob(jobId.trim());
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/jobs/:id
adminRouter.delete('/jobs/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobId = req.params.id;
    if (!jobId || typeof jobId !== 'string' || jobId.trim().length === 0) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'ID pekerjaan tidak valid',
        },
      });
      return;
    }

    await deleteAdminJob(jobId.trim());
    res.status(200).json({
      message: 'Riwayat pekerjaan berhasil dihapus',
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/trends
adminRouter.get('/trends', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = AdminTrendsQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Parameter query rentang waktu tidak valid (gunakan 7d, 30d, atau 90d)',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const trends = await getAdminTrends(parseResult.data.range);
    res.setHeader('Cache-Control', 'no-store, private');
    res.status(200).json(trends);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/system/status
adminRouter.get('/system/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await getAdminSystemStatus();
    res.setHeader('Cache-Control', 'no-store, private');
    res.status(200).json(status);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/courses
adminRouter.get('/courses', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = AdminCourseListQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Parameter query mata kuliah tidak valid',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
      return;
    }
    const result = await listAdminCourses(parseResult.data);
    res.setHeader('Cache-Control', 'no-store, private');
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/materials
adminRouter.get('/materials', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = AdminMaterialListQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Parameter query materi tidak valid',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
      return;
    }
    const result = await listAdminMaterials(parseResult.data);
    res.setHeader('Cache-Control', 'no-store, private');
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/materials/:id
adminRouter.patch('/materials/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const materialId = req.params.id;
    if (!materialId || typeof materialId !== 'string' || materialId.trim().length === 0) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'ID materi tidak valid',
        },
      });
      return;
    }

    const parseResult = AdminUpdateMaterialInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Data pembaruan materi tidak valid',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const result = await updateAdminMaterial(materialId.trim(), parseResult.data);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/materials/:id
adminRouter.delete('/materials/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const materialId = req.params.id;
    if (!materialId || typeof materialId !== 'string' || materialId.trim().length === 0) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'ID materi tidak valid',
        },
      });
      return;
    }

    await deleteAdminMaterial(materialId.trim());
    res.status(200).json({
      message: 'Materi berhasil dihapus dan kuota telah dikembalikan',
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/assignments
adminRouter.get('/assignments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = AdminAssignmentListQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Parameter query tugas tidak valid',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
      return;
    }
    const result = await listAdminAssignments(parseResult.data);
    res.setHeader('Cache-Control', 'no-store, private');
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/notes
adminRouter.get('/notes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = AdminNoteListQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Parameter query catatan tidak valid',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
      return;
    }
    const result = await listAdminNotes(parseResult.data);
    res.setHeader('Cache-Control', 'no-store, private');
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/schedules
adminRouter.get('/schedules', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = AdminScheduleListQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Parameter query jadwal tidak valid',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
      return;
    }
    const result = await listAdminSchedules(parseResult.data);
    res.setHeader('Cache-Control', 'no-store, private');
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/quizzes
adminRouter.get('/quizzes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = AdminQuizListQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Parameter query kuis tidak valid',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
      return;
    }
    const result = await listAdminQuizzes(parseResult.data);
    res.setHeader('Cache-Control', 'no-store, private');
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});




