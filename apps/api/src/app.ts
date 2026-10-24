import type { IncomingMessage, ServerResponse } from 'node:http';
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet, { type HelmetOptions } from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { requestLogger, sanitizeRequestPath } from './middleware/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { readyRouter } from './routes/ready.js';
import { authRouter } from './routes/auth.js';
import { semesterRouter } from './routes/semesters.js';
import { courseRouter } from './routes/courses.js';
import { assignmentRouter } from './routes/assignments.js';
import { noteRouter } from './routes/notes.js';
import { dashboardRouter } from './routes/dashboard.js';
import { materialRouter } from './routes/materials.js';
import { flashcardRouter, quizRouter, attemptRouter } from './routes/learning.js';
import { localStorageRouter } from './routes/localStorage.js';
import { scheduleRouter } from './routes/schedules.js';
import { calendarRouter } from './routes/calendar.js';
import { searchRouter } from './routes/search.js';
import { adminAuthRouter } from './routes/adminAuth.js';
import { adminRouter } from './routes/admin.js';

type HelmetMiddlewareFactory = (
  options?: Readonly<HelmetOptions>
) => (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => void;

function resolveHelmetMiddleware(
  mod: HelmetMiddlewareFactory | { readonly default: HelmetMiddlewareFactory }
): HelmetMiddlewareFactory {
  return typeof mod === 'function' ? mod : mod.default;
}

const helmetMiddleware = resolveHelmetMiddleware(helmet);

export function createApp(): Express {
  const app = express();

  // Configure trust proxy explicitly based on deployment topology
  if (env.TRUST_PROXY === 'false') {
    app.set('trust proxy', false);
  } else if (env.TRUST_PROXY === 'true') {
    app.set('trust proxy', true);
  } else if (env.TRUST_PROXY.includes(',')) {
    // Comma-separated list of trusted proxies / subnets
    app.set('trust proxy', env.TRUST_PROXY.split(',').map((p) => p.trim()));
  } else {
    // Single keyword e.g. 'loopback' or single IP/subnet
    app.set('trust proxy', env.TRUST_PROXY);
  }

  // Security headers with cross-origin resource policy for local file previews
  app.use(
    helmetMiddleware({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // CORS configuration
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);
      const configuredOrigins = env.CORS_ORIGIN
        ? env.CORS_ORIGIN.split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean)
        : [];
      const allowedOrigins = new Set<string>();
      for (const org of configuredOrigins) {
        allowedOrigins.add(org);
        allowedOrigins.add(`${org}/`);
      }
      if (env.NODE_ENV !== 'production') {
        const devPorts = ['3000', '3002', '3005'];
        for (const port of devPorts) {
          allowedOrigins.add(`http://localhost:${port}`);
          allowedOrigins.add(`http://localhost:${port}/`);
          allowedOrigins.add(`http://127.0.0.1:${port}`);
          allowedOrigins.add(`http://127.0.0.1:${port}/`);
        }
      }
      const normalizedOrigin = origin.replace(/\/+$/, '');
      if (allowedOrigins.has(origin) || allowedOrigins.has(normalizedOrigin)) {
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

  // Milestone 2, 3, 4, 5, 6 & 7 API endpoints
  app.use('/api/auth', authRouter);
  app.use('/api/admin/auth', adminAuthRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/semesters', semesterRouter);
  app.use('/api/courses', courseRouter);
  app.use('/api/assignments', assignmentRouter);
  app.use('/api/notes', noteRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/materials', materialRouter);
  app.use('/api/flashcards', flashcardRouter);
  app.use('/api/quizzes', quizRouter);
  app.use('/api/attempts', attemptRouter);
  app.use('/api/schedules', scheduleRouter);
  app.use('/api/calendar', calendarRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/storage/local', localStorageRouter);

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Route ${req.method} ${sanitizeRequestPath(req.originalUrl || req.url)} tidak ditemukan`,
        requestId: req.id,
      },
    });
  });

  // Centralized error handler
  app.use(errorHandler);

  return app;
}
