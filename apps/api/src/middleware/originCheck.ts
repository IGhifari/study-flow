import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { AppError } from './errorHandler.js';

export function originCheckMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  // Only enforce origin check on state-changing methods (CSRF mitigation)
  const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!stateChangingMethods.includes(req.method)) {
    return next();
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // Explicitly reject "null" origin (e.g., sandboxed iframes, privacy extensions, or file://)
  if (origin === 'null') {
    const error: AppError = new Error('Permintaan ditolak: Origin null tidak diizinkan');
    error.statusCode = 403;
    error.code = 'CSRF_ORIGIN_INVALID';
    return next(error);
  }

  // Parse allowed origins from CORS_ORIGIN config
  const configuredOrigins = env.CORS_ORIGIN
    ? env.CORS_ORIGIN.split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean)
    : [];

  const allowedOrigins = new Set<string>();
  for (const org of configuredOrigins) {
    allowedOrigins.add(org);
    allowedOrigins.add(`${org}/`);
  }

  // In non-production environments, allow local development frontend ports
  if (env.NODE_ENV !== 'production') {
    const devPorts = ['3000', '3002', '3005'];
    for (const port of devPorts) {
      allowedOrigins.add(`http://localhost:${port}`);
      allowedOrigins.add(`http://localhost:${port}/`);
      allowedOrigins.add(`http://127.0.0.1:${port}`);
      allowedOrigins.add(`http://127.0.0.1:${port}/`);
    }
  }

  let requestOrigin: string | null = null;

  if (origin && typeof origin === 'string') {
    requestOrigin = origin;
  } else if (referer && typeof referer === 'string') {
    try {
      const url = new URL(referer);
      requestOrigin = url.origin;
    } catch {
      requestOrigin = null;
    }
  }

  // If both Origin and Referer are absent on a state-changing request,
  // reject according to secure CSRF defense-in-depth policy
  if (!requestOrigin) {
    const error: AppError = new Error('Permintaan ditolak: Header Origin atau Referer wajib ada untuk aksi ini');
    error.statusCode = 403;
    error.code = 'CSRF_ORIGIN_INVALID';
    return next(error);
  }

  // Verify that request origin is explicitly allowed
  const normalizedRequestOrigin = requestOrigin.replace(/\/+$/, '');
  if (!allowedOrigins.has(requestOrigin) && !allowedOrigins.has(normalizedRequestOrigin)) {
    const error: AppError = new Error('Permintaan ditolak: Origin tidak diizinkan atau CSRF terdeteksi');
    error.statusCode = 403;
    error.code = 'CSRF_ORIGIN_INVALID';
    return next(error);
  }

  next();
}
