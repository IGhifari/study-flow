import { Router, Request, Response, NextFunction } from 'express';
import {
  UpdateFlashcardMasteryInputSchema,
  SubmitQuizAttemptInputSchema,
  SaveQuizDraftAnswersInputSchema,
} from '@studyflow/shared';
import {
  updateFlashcardMastery,
  startOrResumeQuizAttempt,
  saveQuizDraftAnswers,
  submitQuizAttempt,
  getQuizAttemptResult,
} from '../services/learning.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { originCheckMiddleware } from '../middleware/originCheck.js';

export const flashcardRouter = Router();
flashcardRouter.use(authenticate);
flashcardRouter.use(originCheckMiddleware);

// PATCH /api/flashcards/:id — Update mastery status ('UNRATED' | 'NEED_REVIEW' | 'MASTERED')
flashcardRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const parsedBody = UpdateFlashcardMasteryInputSchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Status pemahaman kartu tidak valid (pilih UNRATED, NEED_REVIEW, atau MASTERED)',
          details: parsedBody.error.format(),
        },
      });
      return;
    }

    const result = await updateFlashcardMastery(req.user!.id, id, parsedBody.data.masteryStatus);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export const quizRouter = Router();
quizRouter.use(authenticate);
quizRouter.use(originCheckMiddleware);

// POST /api/quizzes/:id/attempts — Start or resume quiz attempt (does NOT leak correct answers)
quizRouter.post('/:id/attempts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const result = await startOrResumeQuizAttempt(req.user!.id, id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export const attemptRouter = Router();
attemptRouter.use(authenticate);
attemptRouter.use(originCheckMiddleware);

// PATCH /api/attempts/:id/answers — Save draft answers before submit
attemptRouter.patch('/:id/answers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const parsedBody = SaveQuizDraftAnswersInputSchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Format penyimpanan jawaban kuis tidak valid',
          details: parsedBody.error.format(),
        },
      });
      return;
    }

    const result = await saveQuizDraftAnswers(req.user!.id, id, parsedBody.data.answers);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/attempts/:id/submit — Submit answers, score on server, return review
attemptRouter.post('/:id/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const parsedBody = SubmitQuizAttemptInputSchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Format jawaban kuis tidak valid',
          details: parsedBody.error.format(),
        },
      });
      return;
    }

    const result = await submitQuizAttempt(req.user!.id, id, parsedBody.data.answers);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/attempts/:id — View attempt result
attemptRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const result = await getQuizAttemptResult(req.user!.id, id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});
