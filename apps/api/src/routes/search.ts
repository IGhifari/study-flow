import { Router, Request, Response, NextFunction } from 'express';
import { SearchQuerySchema } from '@studyflow/shared';
import { searchGlobal } from '../services/search.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { originCheckMiddleware } from '../middleware/originCheck.js';
import { AppError } from '../middleware/errorHandler.js';

export const searchRouter = Router();

// Endpoint pencarian membutuhkan autentikasi dan proteksi origin
searchRouter.use(authenticate);
searchRouter.use(originCheckMiddleware);

// GET /api/search
searchRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedQuery = SearchQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      const error: AppError = new Error(
        parsedQuery.error.errors[0]?.message || 'Parameter pencarian tidak valid'
      );
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      return next(error);
    }

    const result = await searchGlobal(req.user!.id, parsedQuery.data);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});
