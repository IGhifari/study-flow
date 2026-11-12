import express, { Router, Request, Response, NextFunction } from 'express';
import path from 'node:path';
import { FILE_UPLOAD_LIMITS } from '@studyflow/shared';
import {
  getStorageAdapter,
  verifyLocalStorageToken,
} from '../services/storage.service.js';

export const localStorageRouter = Router();

// Middleware to parse raw binary payloads up to 20 MiB for upload
const rawBodyParser = express.raw({
  type: '*/*',
  limit: FILE_UPLOAD_LIMITS.maxSizeBytes,
});

/**
 * PUT /api/storage/local/upload/:key
 * Authorized endpoint for direct file upload in local development mode.
 */
localStorageRouter.put(
  '/upload/:key',
  rawBodyParser,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const keyParam = req.params.key as string;
      const storageKey = decodeURIComponent(keyParam || '');
      const token = (req.query.token as string) || '';

      if (!token || !verifyLocalStorageToken(storageKey, token, 'upload')) {
        res.status(403).json({
          error: {
            code: 'INVALID_STORAGE_TOKEN',
            message: 'Tautan unggah lokal tidak valid atau telah kedaluwarsa.',
          },
        });
        return;
      }

      if (!req.body || (Buffer.isBuffer(req.body) && req.body.length === 0)) {
        res.status(400).json({
          error: {
            code: 'EMPTY_FILE',
            message: 'File yang dikirim kosong.',
          },
        });
        return;
      }

      const adapter = getStorageAdapter();
      const contentType = req.headers['content-type'] || 'application/pdf';
      const uploadRes = await adapter.upload(storageKey, req.body, { contentType });

      if (uploadRes.error) {
        res.status(500).json({
          error: {
            code: 'STORAGE_WRITE_ERROR',
            message: 'Gagal menyimpan berkas ke penyimpanan lokal.',
          },
        });
        return;
      }

      res.status(200).json({
        message: 'File berhasil diunggah ke storage lokal.',
        key: storageKey,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/storage/local/download/:key
 * Authorized endpoint for streaming file content with signed token verification.
 */
localStorageRouter.get(
  '/download/:key',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const keyParam = req.params.key as string;
      const storageKey = decodeURIComponent(keyParam || '');
      const token = (req.query.token as string) || '';

      if (!token || !verifyLocalStorageToken(storageKey, token, 'download')) {
        res.status(403).json({
          error: {
            code: 'INVALID_STORAGE_TOKEN',
            message: 'Tautan unduh/pratinjau lokal tidak valid atau telah kedaluwarsa.',
          },
        });
        return;
      }

      const adapter = getStorageAdapter();
      const downloadRes = await adapter.download(storageKey);

      if (downloadRes.error) {
        if (downloadRes.error.message.includes('20 MiB')) {
          res.status(413).json({
            error: {
              code: 'FILE_TOO_LARGE',
              message: 'Ukuran berkas melebihi batas maksimal 20 MiB.',
            },
          });
          return;
        }
        res.status(404).json({
          error: {
            code: 'FILE_NOT_FOUND',
            message: 'File tidak ditemukan di storage lokal.',
          },
        });
        return;
      }

      if (!downloadRes.data) {
        res.status(404).json({
          error: {
            code: 'FILE_NOT_FOUND',
            message: 'File tidak ditemukan di storage lokal.',
          },
        });
        return;
      }

      const buffer = Buffer.isBuffer(downloadRes.data)
        ? downloadRes.data
        : Buffer.from(downloadRes.data as any);

      const safeFilename = (path.basename(storageKey) || 'document.pdf').replace(/["\\\r\n]/g, '_');

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Cache-Control', 'private, max-age=300');

      res.status(200).send(buffer);
    } catch (err) {
      next(err);
    }
  }
);
