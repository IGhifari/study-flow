import { Router, Request, Response, NextFunction } from 'express';
import {
  CreateSemesterInputSchema,
  UpdateSemesterInputSchema,
  SemesterListQuerySchema,
} from '@studyflow/shared';
import {
  listSemesters,
  getSemesterById,
  createSemester,
  updateSemester,
  activateSemester,
  archiveSemester,
  unarchiveSemester,
  deleteSemester,
} from '../services/semester.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { originCheckMiddleware } from '../middleware/originCheck.js';
import { AppError } from '../middleware/errorHandler.js';

export const semesterRouter = Router();

// All semester endpoints require authentication and CSRF/Origin validation
semesterRouter.use(authenticate);
semesterRouter.use(originCheckMiddleware);

// GET /api/semesters
semesterRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedQuery = SemesterListQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      const error: AppError = new Error(parsedQuery.error.issues[0]?.message || 'Query parameter tidak valid');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      return next(error);
    }

    const result = await listSemesters(req.user!.id, parsedQuery.data);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/semesters/:id
semesterRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const semester = await getSemesterById(req.user!.id, id);
    res.status(200).json({ semester });
  } catch (err) {
    next(err);
  }
});

// POST /api/semesters
semesterRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedBody = CreateSemesterInputSchema.safeParse(req.body);
    if (!parsedBody.success) {
      const error: AppError = new Error(parsedBody.error.issues[0]?.message || 'Input semester tidak valid');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      return next(error);
    }

    const semester = await createSemester(req.user!.id, parsedBody.data);
    res.status(201).json({
      message: 'Semester berhasil ditambahkan',
      semester,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/semesters/:id
semesterRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedBody = UpdateSemesterInputSchema.safeParse(req.body);
    if (!parsedBody.success) {
      const error: AppError = new Error(parsedBody.error.issues[0]?.message || 'Input pembaruan semester tidak valid');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      return next(error);
    }

    const id = req.params.id as string;
    const semester = await updateSemester(req.user!.id, id, parsedBody.data);
    res.status(200).json({
      message: 'Semester berhasil diperbarui',
      semester,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/semesters/:id/activate
semesterRouter.post('/:id/activate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const semester = await activateSemester(req.user!.id, id);
    res.status(200).json({
      message: 'Semester aktif berhasil diubah',
      semester,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/semesters/:id/archive
semesterRouter.post('/:id/archive', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const semester = await archiveSemester(req.user!.id, id);
    res.status(200).json({
      message: 'Semester berhasil diarsipkan',
      semester,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/semesters/:id/unarchive
semesterRouter.post('/:id/unarchive', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const semester = await unarchiveSemester(req.user!.id, id);
    res.status(200).json({
      message: 'Semester berhasil dipulihkan dari arsip',
      semester,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/semesters/:id
semesterRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    await deleteSemester(req.user!.id, id);
    res.status(200).json({
      message: 'Semester berhasil dihapus',
    });
  } catch (err) {
    next(err);
  }
});
