import { Router, Request, Response, NextFunction } from 'express';
import {
  InitiateUploadInputSchema,
  FinalizeUploadInputSchema,
  UpdateMaterialInputSchema,
  MaterialListQuerySchema,
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
        parsedQuery.error.errors[0]?.message || 'Query parameter tidak valid'
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
          parsedBody.error.errors[0]?.message || 'Input upload materi tidak valid'
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
          parsedBody.error.errors[0]?.message || 'Input finalisasi materi tidak valid'
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
        parsedBody.error.errors[0]?.message || 'Input pembaruan materi tidak valid'
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
