import { Router, Request, Response, NextFunction } from 'express';
import {
  CreateCourseInputSchema,
  UpdateCourseInputSchema,
  CourseListQuerySchema,
} from '@studyflow/shared';
import {
  listCourses,
  getCourseById,
  createCourse,
  updateCourse,
  archiveCourse,
  unarchiveCourse,
  deleteCourse,
} from '../services/course.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { originCheckMiddleware } from '../middleware/originCheck.js';
import { AppError } from '../middleware/errorHandler.js';

export const courseRouter = Router();

// All course endpoints require authentication and CSRF/Origin validation
courseRouter.use(authenticate);
courseRouter.use(originCheckMiddleware);

// GET /api/courses
courseRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedQuery = CourseListQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      const error: AppError = new Error(parsedQuery.error.issues[0]?.message || 'Query parameter tidak valid');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      return next(error);
    }

    const result = await listCourses(req.user!.id, parsedQuery.data);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/courses/:id
courseRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const course = await getCourseById(req.user!.id, id);
    res.status(200).json({ course });
  } catch (err) {
    next(err);
  }
});

// POST /api/courses
courseRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedBody = CreateCourseInputSchema.safeParse(req.body);
    if (!parsedBody.success) {
      const error: AppError = new Error(parsedBody.error.issues[0]?.message || 'Input mata kuliah tidak valid');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      return next(error);
    }

    const course = await createCourse(req.user!.id, parsedBody.data);
    res.status(201).json({
      message: 'Mata kuliah berhasil ditambahkan',
      course,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/courses/:id
courseRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedBody = UpdateCourseInputSchema.safeParse(req.body);
    if (!parsedBody.success) {
      const error: AppError = new Error(parsedBody.error.issues[0]?.message || 'Input pembaruan mata kuliah tidak valid');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      return next(error);
    }

    const id = req.params.id as string;
    const course = await updateCourse(req.user!.id, id, parsedBody.data);
    res.status(200).json({
      message: 'Mata kuliah berhasil diperbarui',
      course,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/courses/:id/archive
courseRouter.post('/:id/archive', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const course = await archiveCourse(req.user!.id, id);
    res.status(200).json({
      message: 'Mata kuliah berhasil diarsipkan',
      course,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/courses/:id/unarchive
courseRouter.post('/:id/unarchive', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const course = await unarchiveCourse(req.user!.id, id);
    res.status(200).json({
      message: 'Mata kuliah berhasil dipulihkan dari arsip',
      course,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/courses/:id
courseRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    await deleteCourse(req.user!.id, id);
    res.status(200).json({
      message: 'Mata kuliah berhasil dihapus',
    });
  } catch (err) {
    next(err);
  }
});
