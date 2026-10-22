import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  currentVersion?: number;
  details?: unknown;
}

/**
 * Redacts sensitive tokens, JWTs, query parameter secrets, Bearer credentials,
 * and database passwords from error messages and stack traces before logging.
 */
export function redactSensitiveErrorText(text: string | undefined): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    // 1. Redact JWT tokens (header.payload.signature)
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[REDACTED_JWT]')
    // 2. Redact query parameter secrets: ?token=..., &token=..., &secret=..., &key=..., etc.
    .replace(/([?&](?:token|key|secret|password|apiKey|api_key|access_token|refresh_token|code)=)[^&\s"'`]+/gi, '$1[REDACTED]')
    // 3. Redact Bearer / Basic auth tokens
    .replace(/((?:Bearer|Basic)\s+)[A-Za-z0-9._~+/-]+=*/gi, '$1[REDACTED]')
    // 4. Redact database passwords in connection URLs (e.g. postgresql://user:pass@host)
    .replace(/(:\/\/[^:]+:)[^@]+(@)/g, '$1[REDACTED]$2');
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

  const sanitizedMessage = redactSensitiveErrorText(err.message);
  const sanitizedStack = err.stack ? redactSensitiveErrorText(err.stack) : undefined;

  // Log full error internally for diagnostics without leaking to client or exposing secrets
  console.error(JSON.stringify({
    level: 'error',
    timestamp: new Date().toISOString(),
    requestId,
    errorCode,
    statusCode,
    message: sanitizedMessage,
    // Do not log in test to avoid clutter
    ...(process.env.NODE_ENV !== 'test' && { stack: sanitizedStack }),
  }));

  // Safe client response
  const message = statusCode === 500
    ? 'Terjadi kesalahan internal pada server'
    : sanitizedMessage;

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
