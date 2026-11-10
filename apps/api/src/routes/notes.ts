import { Router, Request, Response, NextFunction } from 'express';
import {
  CreateNoteInputSchema,
  UpdateNoteInputSchema,
  NoteListQuerySchema,
  SetPinInputSchema,
} from '@studyflow/shared';
import {
  listNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
} from '../services/note.service.js';
import { setNotePin } from '../services/pin.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { originCheckMiddleware } from '../middleware/originCheck.js';
import { AppError } from '../middleware/errorHandler.js';

export const noteRouter = Router();

noteRouter.use(authenticate);
noteRouter.use(originCheckMiddleware);

// GET /api/notes
noteRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedQuery = NoteListQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      const error: AppError = new Error(parsedQuery.error.issues[0]?.message || 'Query parameter tidak valid');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      return next(error);
    }

    const result = await listNotes(req.user!.id, parsedQuery.data);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/notes/:id
noteRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const note = await getNoteById(req.user!.id, id);
    res.status(200).json({ note });
  } catch (err) {
    next(err);
  }
});

// POST /api/notes
noteRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedBody = CreateNoteInputSchema.safeParse(req.body);
    if (!parsedBody.success) {
      const error: AppError = new Error(parsedBody.error.issues[0]?.message || 'Input catatan tidak valid');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      return next(error);
    }

    const note = await createNote(req.user!.id, parsedBody.data);
    res.status(201).json({
      message: 'Catatan berhasil dibuat',
      note,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notes/:id
noteRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Explicitly reject courseId in payload
    if ('courseId' in req.body) {
      const error: AppError = new Error('Pemindahan mata kuliah catatan belum didukung pada versi ini');
      error.statusCode = 400;
      error.code = 'CANNOT_CHANGE_COURSE';
      return next(error);
    }

    const parsedBody = UpdateNoteInputSchema.safeParse(req.body);
    if (!parsedBody.success) {
      const error: AppError = new Error(parsedBody.error.issues[0]?.message || 'Input pembaruan catatan tidak valid');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      return next(error);
    }

    const id = req.params.id as string;
    const note = await updateNote(req.user!.id, id, parsedBody.data);
    res.status(200).json({
      message: 'Catatan berhasil diperbarui',
      note,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notes/:id/pin — Pin or unpin note
noteRouter.patch('/:id/pin', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const parseResult = SetPinInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Status pin tidak valid',
          details: parseResult.error.format(),
        },
      });
      return;
    }

    const result = await setNotePin(req.user!.id, id, parseResult.data.pinned);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/notes/:id
noteRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    await deleteNote(req.user!.id, id);
    res.status(200).json({
      message: 'Catatan berhasil dihapus',
    });
  } catch (err) {
    next(err);
  }
});
