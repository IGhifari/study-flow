import { Router, Request, Response, NextFunction } from 'express';
import { AdminUserListQuerySchema, AdminJobListQuerySchema } from '@studyflow/shared';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  getAdminSummary,
  listAdminUsers,
  getAdminUserDetail,
  listAdminJobs,
  getAdminJobDetail,
  getAdminQueuesSummary,
} from '../services/admin.service.js';

export const adminRouter = Router();

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


