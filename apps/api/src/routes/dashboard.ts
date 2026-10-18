import { Router, Request, Response, NextFunction } from 'express';
import {
  DashboardPinnedQuerySchema,
  DashboardChartsQuerySchema,
} from '@studyflow/shared';
import { authenticate } from '../middleware/authenticate.js';
import { getDashboardSummary, getDashboardCharts } from '../services/dashboard.service.js';
import { getPinnedItems } from '../services/pin.service.js';
import { AppError } from '../middleware/errorHandler.js';

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

// GET /api/dashboard/pinned
dashboardRouter.get(
  '/pinned',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsedQuery = DashboardPinnedQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        const error: AppError = new Error(parsedQuery.error.errors[0]?.message || 'Query parameter pinned tidak valid');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        return next(error);
      }

      const pinned = await getPinnedItems(req.user!.id, parsedQuery.data.semesterId);
      res.json(pinned);
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
      const parsedQuery = DashboardChartsQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        const error: AppError = new Error(parsedQuery.error.errors[0]?.message || 'Query parameter chart tidak valid');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        return next(error);
      }

      const charts = await getDashboardCharts(req.user!.id, {
        period: parsedQuery.data.period,
        semesterId: parsedQuery.data.semesterId,
      });
      res.json(charts);
    } catch (err) {
      next(err);
    }
  }
);

