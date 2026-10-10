import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  currentVersion?: number;
  details?: unknown;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode && err.statusCode >= 400 && err.statusCode < 600
    ? err.statusCode
    : 500;

  const errorCode = err.code || (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST');
  const requestId = req.id || 'unknown';

  // Log full error internally for diagnostics without leaking to client
  console.error(JSON.stringify({
    level: 'error',
    timestamp: new Date().toISOString(),
    requestId,
    errorCode,
    statusCode,
    message: err.message,
    // Do not log in test to avoid clutter
    ...(process.env.NODE_ENV !== 'test' && { stack: err.stack }),
  }));

  // Safe client response
  const message = statusCode === 500
    ? 'Terjadi kesalahan internal pada server'
    : err.message;

  res.status(statusCode).json({
    error: {
      code: errorCode,
      message,
      requestId,
      ...(err.currentVersion !== undefined ? { currentVersion: err.currentVersion } : {}),
      ...(err.details !== undefined ? { details: err.details } : {}),
    },
  });
}
