import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { requestLogger } from './middleware/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { readyRouter } from './routes/ready.js';
import { authRouter } from './routes/auth.js';
import { semesterRouter } from './routes/semesters.js';
import { courseRouter } from './routes/courses.js';

export function createApp(): Express {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS configuration
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);
      const allowedOrigins = [
        env.CORS_ORIGIN,
        'http://localhost:3000',
        'http://127.0.0.1:3000',
      ];
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  }));

  // Body and cookie parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser(env.COOKIE_SECRET));

  // Request ID and structured logging
  app.use(requestIdMiddleware);
  app.use(requestLogger);

  // Health and readiness endpoints
  app.use('/health', healthRouter);
  app.use('/ready', readyRouter);

  // Milestone 2 & 3 API endpoints
  app.use('/api/auth', authRouter);
  app.use('/api/semesters', semesterRouter);
  app.use('/api/courses', courseRouter);

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
