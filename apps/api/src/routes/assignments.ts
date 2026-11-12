import { Router, Request, Response, NextFunction } from 'express';
import {
  CreateAssignmentInputSchema,
  UpdateAssignmentInputSchema,
  AssignmentListQuerySchema,
  CreateSubtaskInputSchema,
  UpdateSubtaskInputSchema,
} from '@studyflow/shared';
import {
  listAssignments,
  getAssignmentById,
  createAssignment,
  updateAssignment,
  deleteAssignment,
} from '../services/assignment.service.js';
import {
  getSubtasks,
  createSubtask,
  updateSubtask,
  deleteSubtask,
} from '../services/subtask.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { originCheckMiddleware } from '../middleware/originCheck.js';
import { AppError } from '../middleware/errorHandler.js';

export const assignmentRouter = Router();

assignmentRouter.use(authenticate);
assignmentRouter.use(originCheckMiddleware);

// GET /api/assignments
assignmentRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedQuery = AssignmentListQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      const error: AppError = new Error(parsedQuery.error.issues[0]?.message || 'Query parameter tidak valid');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      return next(error);
    }

    const result = await listAssignments(req.user!.id, parsedQuery.data);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/assignments/:id
assignmentRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const assignment = await getAssignmentById(req.user!.id, id);
    res.status(200).json({ assignment });
  } catch (err) {
    next(err);
  }
});

// POST /api/assignments
assignmentRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedBody = CreateAssignmentInputSchema.safeParse(req.body);
    if (!parsedBody.success) {
      const error: AppError = new Error(parsedBody.error.issues[0]?.message || 'Input tugas tidak valid');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      return next(error);
    }

    const assignment = await createAssignment(req.user!.id, parsedBody.data);
    res.status(201).json({
      message: 'Tugas berhasil ditambahkan',
      assignment,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/assignments/:id
assignmentRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Explicitly reject courseId in payload
    if ('courseId' in req.body) {
      const error: AppError = new Error('Pemindahan mata kuliah tugas belum didukung pada versi ini');
      error.statusCode = 400;
      error.code = 'CANNOT_CHANGE_COURSE';
      return next(error);
    }

    const parsedBody = UpdateAssignmentInputSchema.safeParse(req.body);
    if (!parsedBody.success) {
      const error: AppError = new Error(parsedBody.error.issues[0]?.message || 'Input pembaruan tugas tidak valid');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      return next(error);
    }

    const id = req.params.id as string;
    const assignment = await updateAssignment(req.user!.id, id, parsedBody.data);
    res.status(200).json({
      message: 'Tugas berhasil diperbarui',
      assignment,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/assignments/:id
assignmentRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    await deleteAssignment(req.user!.id, id);
    res.status(200).json({
      message: 'Tugas berhasil dihapus',
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/assignments/:assignmentId/subtasks
assignmentRouter.get('/:assignmentId/subtasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const assignmentId = req.params.assignmentId as string;
    const subtasks = await getSubtasks(req.user!.id, assignmentId);
    res.status(200).json({ subtasks });
  } catch (err) {
    next(err);
  }
});

// POST /api/assignments/:assignmentId/subtasks
assignmentRouter.post('/:assignmentId/subtasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = CreateSubtaskInputSchema.safeParse(req.body);
    if (!parsed.success) {
      const error: AppError = new Error(parsed.error.issues[0]?.message || 'Input subtugas tidak valid');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      return next(error);
    }

    const assignmentId = req.params.assignmentId as string;
    const subtask = await createSubtask(req.user!.id, assignmentId, parsed.data);
    res.status(201).json({
      message: 'Subtugas berhasil ditambahkan',
      subtask,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/assignments/:assignmentId/subtasks/:subtaskId
assignmentRouter.patch('/:assignmentId/subtasks/:subtaskId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = UpdateSubtaskInputSchema.safeParse(req.body);
    if (!parsed.success) {
      const error: AppError = new Error(parsed.error.issues[0]?.message || 'Input pembaruan subtugas tidak valid');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      return next(error);
    }

    const assignmentId = req.params.assignmentId as string;
    const subtaskId = req.params.subtaskId as string;
    const subtask = await updateSubtask(req.user!.id, assignmentId, subtaskId, parsed.data);
    res.status(200).json({
      message: 'Subtugas berhasil diperbarui',
      subtask,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/assignments/:assignmentId/subtasks/:subtaskId
assignmentRouter.delete('/:assignmentId/subtasks/:subtaskId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const assignmentId = req.params.assignmentId as string;
    const subtaskId = req.params.subtaskId as string;
    await deleteSubtask(req.user!.id, assignmentId, subtaskId);
    res.status(200).json({
      message: 'Subtugas berhasil dihapus',
    });
  } catch (err) {
    next(err);
  }
});
