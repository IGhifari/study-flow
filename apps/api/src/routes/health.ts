import { Router, Request, Response } from 'express';
import { HealthResponse } from '@studyflow/shared';
import { env } from '../config/env.js';

export const healthRouter = Router();

healthRouter.get('/', (_req: Request, res: Response) => {
  const response: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    service: 'studyflow-api',
    version: '0.1.0',
    environment: env.NODE_ENV,
  };

  res.status(200).json(response);
});
