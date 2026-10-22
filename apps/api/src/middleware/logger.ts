import { Request, Response, NextFunction } from 'express';

/**
 * Extracts and sanitizes the URL path for logging.
 * Strips all query parameters (?token=..., ?secret=..., etc.), hash fragments,
 * and dangerous CRLF injection characters, ensuring sensitive tokens or signed URL parameters
 * are never recorded in access logs or telemetry.
 */
export function sanitizeRequestPath(rawUrl: string | undefined): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return '/';
  }

  // Strip CRLF control characters to prevent log injection
  const cleanRaw = rawUrl.replace(/[\r\n]/g, '').trim();
  if (!cleanRaw) {
    return '/';
  }

  try {
    if (cleanRaw.startsWith('/')) {
      // Avoid protocol-relative URLs (e.g. //evil.com/path)
      const normalizedRelative = cleanRaw.replace(/^\/{2,}/, '/');
      const parsed = new URL(normalizedRelative, 'http://localhost');
      return parsed.pathname || '/';
    }
    const parsed = new URL(cleanRaw);
    return parsed.pathname || '/';
  } catch {
    // Fallback: manually strip query string and hash
    const pathOnly = cleanRaw.split('?')[0]?.split('#')[0] || '/';
    return pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
  }
}

/**
 * Sanitizes headers such as User-Agent to prevent log injection.
 */
export function sanitizeHeaderValue(val: string | string[] | undefined, maxLen = 500): string {
  if (!val) return 'unknown';
  const str = Array.isArray(val) ? val.join(', ') : val;
  return str.replace(/[\r\n]/g, '').slice(0, maxLen).trim() || 'unknown';
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const logData = {
      level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      timestamp: new Date().toISOString(),
      requestId: req.id,
      method: req.method,
      url: sanitizeRequestPath(req.originalUrl || req.url),
      statusCode: res.statusCode,
      durationMs,
      userAgent: sanitizeHeaderValue(req.headers['user-agent']),
    };

    if (process.env.NODE_ENV !== 'test') {
      console.log(JSON.stringify(logData));
    }
  });

  next();
}
