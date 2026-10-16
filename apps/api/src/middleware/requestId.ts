import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';

declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

const REQUEST_ID_REGEX = /^[a-zA-Z0-9._-]{1,128}$/;

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const rawId = req.headers['x-request-id'];
  let requestId: string;

  if (typeof rawId === 'string') {
    const trimmed = rawId.trim();
    if (REQUEST_ID_REGEX.test(trimmed)) {
      requestId = trimmed;
    } else {
      requestId = crypto.randomUUID();
    }
  } else {
    requestId = crypto.randomUUID();
  }

  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
