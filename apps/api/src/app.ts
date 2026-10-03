import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { requestLogger } from './middleware/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { readyRouter } from './routes/ready.js';

export function createApp(): Express {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS configuration
  app.use(cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }));

  // Body parsing
  app.use(express.json({ limit: '1mb' }));

  // Request ID and structured logging
  app.use(requestIdMiddleware);
  app.use(requestLogger);

  // Health and readiness endpoints
  app.use('/health', healthRouter);
  app.use('/ready', readyRouter);

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Route ${req.method} ${req.originalUrl} tidak ditemukan`,
        requestId: req.id,
      },
    });
  });

  // Centralized error handler
  app.use(errorHandler);

  return app;
}
