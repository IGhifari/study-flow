import { Router, Request, Response, NextFunction } from 'express';
import {
  InitiateUploadInputSchema,
  FinalizeUploadInputSchema,
  UpdateMaterialInputSchema,
  MaterialListQuerySchema,
  GenerateSummaryInputSchema,
  GenerateFlashcardsInputSchema,
  GenerateQuizInputSchema,
  SetPinInputSchema,
} from '@studyflow/shared';
import {
  initiateUpload,
  finalizeUpload,
  listMaterials,
  getMaterialById,
  updateMaterial,
  deleteMaterial,
  retryMaterialProcessing,
  getMaterialDownloadUrl,
  getProcessingJobStatus,
} from '../services/material.service.js';
import { getUserStorageUsage } from '../services/quota.service.js';
import {
  requestSummaryGeneration,
  getSummaryByMaterialId,
  getUserQuota,
} from '../services/summary.service.js';
import {
  getFlashcardSets,
  requestFlashcardGeneration,
  getQuizzes,
  requestQuizGeneration,
} from '../services/learning.service.js';
import { setMaterialPin } from '../services/pin.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { originCheckMiddleware } from '../middleware/originCheck.js';
import { AppError } from '../middleware/errorHandler.js';

export const materialRouter = Router();

materialRouter.use(authenticate);
materialRouter.use(originCheckMiddleware);

// GET /api/materials/usage — User storage & upload quota status
materialRouter.get('/usage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const usage = await getUserStorageUsage(req.user!.id);
    res.status(200).json(usage);
  } catch (err) {
    next(err);
  }
});

// GET /api/materials/usage/ai — AI generation daily quota & concurrent status
materialRouter.get('/usage/ai', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quota = await getUserQuota(req.user!.id);
    res.status(200).json({ quota });
  } catch (err) {
    next(err);
  }
});

// GET /api/materials/jobs/:jobId — Processing job status polling
materialRouter.get('/jobs/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobId = req.params.jobId as string;
    const job = await getProcessingJobStatus(req.user!.id, jobId);
    res.status(200).json({ job });
  } catch (err) {
    next(err);
  }
});

// GET /api/materials — List materials with filtering and pagination
materialRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedQuery = MaterialListQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      const error: AppError = new Error(
        parsedQuery.error.issues[0]?.message || 'Query parameter tidak valid'
      );
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      return next(error);
    }

    const result = await listMaterials(req.user!.id, parsedQuery.data);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/materials/initiate-upload — Step 1 of upload flow
materialRouter.post(
  '/initiate-upload',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsedBody = InitiateUploadInputSchema.safeParse(req.body);
      if (!parsedBody.success) {
        const error: AppError = new Error(
          parsedBody.error.issues[0]?.message || 'Input upload materi tidak valid'
        );
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        return next(error);
      }

      const result = await initiateUpload(req.user!.id, parsedBody.data);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/materials/finalize-upload — Step 2 of upload flow (async: returns 202 with jobId)
materialRouter.post(
  '/finalize-upload',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsedBody = FinalizeUploadInputSchema.safeParse(req.body);
      if (!parsedBody.success) {
        const error: AppError = new Error(
          parsedBody.error.issues[0]?.message || 'Input finalisasi materi tidak valid'
        );
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        return next(error);
      }

      const result = await finalizeUpload(req.user!.id, parsedBody.data.materialId);
      res.status(202).json({
        message: 'Upload file berhasil diverifikasi dan dijadwalkan untuk diekstraksi',
        material: result.material,
        jobId: result.jobId,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/materials/:id — Get material detail
materialRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const material = await getMaterialById(req.user!.id, id);
    res.status(200).json({ material });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/materials/:id — Update material title
materialRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedBody = UpdateMaterialInputSchema.safeParse(req.body);
    if (!parsedBody.success) {
      const error: AppError = new Error(
        parsedBody.error.issues[0]?.message || 'Input pembaruan materi tidak valid'
      );
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      return next(error);
    }

    const id = req.params.id as string;
    const material = await updateMaterial(req.user!.id, id, parsedBody.data);
    res.status(200).json({
      message: 'Judul materi berhasil diperbarui',
      material,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/materials/:id/retry — Retry failed document processing (async: returns 202 with jobId)
materialRouter.post(
  '/:id/retry',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const result = await retryMaterialProcessing(req.user!.id, id);
      res.status(202).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/materials/:id/download — Authorized signed preview/download URL
materialRouter.get(
  '/:id/download',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const result = await getMaterialDownloadUrl(req.user!.id, id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/materials/:id/summary — Get summary & AI quota
materialRouter.get(
  '/:id/summary',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const result = await getSummaryByMaterialId(req.user!.id, id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/materials/:id/summary — Request generation or regeneration of AI summary
materialRouter.post(
  '/:id/summary',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const parsedBody = GenerateSummaryInputSchema.safeParse(req.body || {});
      const regenerate = parsedBody.success ? parsedBody.data.regenerate : false;

      const result = await requestSummaryGeneration(req.user!.id, id, regenerate);
      res.status(202).json({
        message: 'Pembuatan ringkasan AI sedang diproses',
        jobId: result.jobId,
        summary: result.summary,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/materials/:id/flashcard-sets — List flashcard sets for material
materialRouter.get(
  '/:id/flashcard-sets',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const sets = await getFlashcardSets(req.user!.id, id);
      res.status(200).json({ sets });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/materials/:id/flashcard-sets — Request generation of flashcard set
materialRouter.post(
  '/:id/flashcard-sets',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const parsedBody = GenerateFlashcardsInputSchema.safeParse(req.body || {});
      if (!parsedBody.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Jumlah kartu tidak valid (pilih 5, 10, atau 20 kartu)',
            details: parsedBody.error.format(),
          },
        });
        return;
      }

      const result = await requestFlashcardGeneration(req.user!.id, id, parsedBody.data.targetCount);
      res.status(202).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/materials/:id/quizzes — List quizzes for material
materialRouter.get(
  '/:id/quizzes',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const quizzes = await getQuizzes(req.user!.id, id);
      res.status(200).json({ quizzes });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/materials/:id/quizzes — Request generation of quiz
materialRouter.post(
  '/:id/quizzes',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const parsedBody = GenerateQuizInputSchema.safeParse(req.body || {});
      if (!parsedBody.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Jumlah soal tidak valid (pilih 5 atau 10 soal)',
            details: parsedBody.error.format(),
          },
        });
        return;
      }

      const result = await requestQuizGeneration(req.user!.id, id, parsedBody.data.targetCount);
      res.status(202).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/materials/:id/pin — Pin or unpin material
materialRouter.patch('/:id/pin', async (req: Request, res: Response, next: NextFunction) => {
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

    const result = await setMaterialPin(req.user!.id, id, parseResult.data.pinned);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/materials/:id — Delete material
materialRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    await deleteMaterial(req.user!.id, id);
    res.status(200).json({
      message: 'Materi berhasil dihapus',
    });
  } catch (err) {
    next(err);
  }
});
