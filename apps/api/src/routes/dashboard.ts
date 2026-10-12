import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { getDashboardSummary, getDashboardCharts } from '../services/dashboard.service.js';

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

// GET /api/dashboard/charts
dashboardRouter.get(
  '/charts',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const period = req.query.period as any;
      const semesterId = typeof req.query.semesterId === 'string' ? req.query.semesterId : undefined;
      const charts = await getDashboardCharts(req.user!.id, {
        period,
        semesterId,
      });
      res.json(charts);
    } catch (err) {
      next(err);
    }
  }
);

