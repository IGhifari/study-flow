import { Router, Request, Response, NextFunction } from 'express';
import {
  CreateCourseScheduleInputSchema,
  UpdateCourseScheduleInputSchema,
  CourseScheduleQuerySchema,
} from '@studyflow/shared';
import {
  listSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
} from '../services/schedule.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { originCheckMiddleware } from '../middleware/originCheck.js';
import { AppError } from '../middleware/errorHandler.js';

export const scheduleRouter = Router();

// Semua endpoint jadwal kuliah membutuhkan autentikasi dan validasi origin/CSRF
scheduleRouter.use(authenticate);
scheduleRouter.use(originCheckMiddleware);

// GET /api/schedules
scheduleRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedQuery = CourseScheduleQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      const error: AppError = new Error(
        parsedQuery.error.issues[0]?.message || 'Query parameter jadwal tidak valid'
      );
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      return next(error);
    }

    const result = await listSchedules(req.user!.id, parsedQuery.data);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/schedules/:id
scheduleRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const result = await getScheduleById(req.user!.id, id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/schedules
scheduleRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedBody = CreateCourseScheduleInputSchema.safeParse(req.body);
    if (!parsedBody.success) {
      const error: AppError = new Error(
        parsedBody.error.issues[0]?.message || 'Input sesi jadwal tidak valid'
      );
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      return next(error);
    }

    const result = await createSchedule(req.user!.id, parsedBody.data);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/schedules/:id
scheduleRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const parsedBody = UpdateCourseScheduleInputSchema.safeParse(req.body);
    if (!parsedBody.success) {
      const error: AppError = new Error(
        parsedBody.error.issues[0]?.message || 'Input pembaruan jadwal tidak valid'
      );
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      return next(error);
    }

    const result = await updateSchedule(req.user!.id, id, parsedBody.data);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/schedules/:id
scheduleRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const result = await deleteSchedule(req.user!.id, id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});
