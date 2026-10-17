import { Router, Request, Response, NextFunction } from 'express';
import {
  AdminUserListQuerySchema,
  AdminJobListQuerySchema,
  AdminTrendsQuerySchema,
  AdminCourseListQuerySchema,
  AdminMaterialListQuerySchema,
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
  listAdminJobs,
  getAdminJobDetail,
  getAdminQueuesSummary,
  getAdminTrends,
  getAdminSystemStatus,
  listAdminCourses,
  listAdminMaterials,
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




