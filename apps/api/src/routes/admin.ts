import { Router, Request, Response, NextFunction } from 'express';
import { AdminUserListQuerySchema } from '@studyflow/shared';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { getAdminSummary, listAdminUsers } from '../services/admin.service.js';

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
