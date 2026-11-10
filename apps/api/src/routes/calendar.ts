import { Router, Request, Response, NextFunction } from 'express';
import { CalendarQuerySchema } from '@studyflow/shared';
import { getCalendarData } from '../services/calendar.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { originCheckMiddleware } from '../middleware/originCheck.js';
import { AppError } from '../middleware/errorHandler.js';

export const calendarRouter = Router();

// Semua endpoint kalender membutuhkan autentikasi dan validasi origin/CSRF
calendarRouter.use(authenticate);
calendarRouter.use(originCheckMiddleware);

// GET /api/calendar
calendarRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedQuery = CalendarQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      const error: AppError = new Error(
        parsedQuery.error.issues[0]?.message || 'Query parameter kalender tidak valid'
      );
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      return next(error);
    }

    const result = await getCalendarData(req.user!.id, parsedQuery.data);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});
