import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { getDashboardSummary } from '../services/dashboard.service.js';

export const dashboardRouter = Router();

// GET /api/dashboard
dashboardRouter.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const summary = await getDashboardSummary(req.user!.id);
      res.json(summary);
    } catch (err) {
      next(err);
    }
  }
);
