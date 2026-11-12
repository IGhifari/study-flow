import { NextRequest, NextResponse } from 'next/server';
import { resolveForwardedClientIp } from './clientIp';
import { getInternalApiUrl } from './api-config';

export { resolveForwardedClientIp };

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const RATE_LIMIT_HEADERS = [
  'retry-after',
  'ratelimit-limit',
  'ratelimit-remaining',
  'ratelimit-reset',
  'ratelimit-policy',
] as const;

/**
 * Sanitizes a URL for logging by removing query strings and hash fragments,
 * preventing sensitive parameters (such as tokens, keys, passwords, codes) from leaking into logs.
 */
export function sanitizeLogUrl(rawUrl: string | undefined): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return '';
  }

  // Strip CRLF control characters to prevent log injection
  const cleanRaw = rawUrl.replace(/[\r\n]/g, '').trim();
  if (!cleanRaw) {
    return '';
  }

  try {
    const parsed = new URL(cleanRaw);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    // Fallback for relative paths: strip query string and hash directly
    return cleanRaw.split('?')[0]?.split('#')[0] || '';
  }
}

/**
 * Sanitizes error message text by redacting JWTs, Bearer credentials,
 * and sensitive query parameters.
 */
export function sanitizeLogText(text: string | undefined): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    // 1. Redact JWT tokens
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[REDACTED_JWT]')
    // 2. Redact query parameter secrets: ?token=..., &token=..., &secret=..., &key=..., etc.
    .replace(/([?&](?:token|key|secret|password|apiKey|api_key|access_token|refresh_token|code)=)[^&\s"'`]+/gi, '$1[REDACTED]')
    // 3. Redact Bearer / Basic auth tokens
    .replace(/((?:Bearer|Basic)\s+)[A-Za-z0-9._~+/-]+=*/gi, '$1[REDACTED]');
}

export interface CsrfValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateCsrfOrigin(req: NextRequest): CsrfValidationResult {
  if (!STATE_CHANGING_METHODS.has(req.method)) {
    return { valid: true };
  }

  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const trustedOrigin = req.nextUrl.origin;

  // 1. Explicitly reject null origin
  if (origin === 'null') {
    return { valid: false, reason: 'Origin null tidak diizinkan' };
  }

  let requestOrigin: string | null = null;
  if (origin) {
    requestOrigin = origin;
  } else if (referer) {
    try {
      const url = new URL(referer);
      requestOrigin = url.origin;
    } catch {
      requestOrigin = null;
    }
  }

  // 2. Reject missing Origin & Referer on state-changing mutations
  if (!requestOrigin) {
    return { valid: false, reason: 'Header Origin atau Referer wajib ada untuk request ini' };
  }

  // 3. Reject foreign/attacker origins
  const normalizedRequestOrigin = requestOrigin.replace(/\/+$/, '');
  const normalizedTrustedOrigin = trustedOrigin.replace(/\/+$/, '');

  const allowedOrigins = new Set<string>([
    trustedOrigin,
    normalizedTrustedOrigin,
    `${normalizedTrustedOrigin}/`,
  ]);

  if (process.env.NODE_ENV !== 'production') {
    const devPorts = ['3000', '3002', '3005'];
    for (const port of devPorts) {
      allowedOrigins.add(`http://localhost:${port}`);
      allowedOrigins.add(`http://localhost:${port}/`);
      allowedOrigins.add(`http://127.0.0.1:${port}`);
      allowedOrigins.add(`http://127.0.0.1:${port}/`);
    }
  }

  if (!allowedOrigins.has(requestOrigin) && !allowedOrigins.has(normalizedRequestOrigin)) {
    return { valid: false, reason: 'Origin tidak diizinkan atau CSRF terdeteksi' };
  }

  return { valid: true };
}

export const MAX_BFF_BODY_BYTES = 1024 * 1024; // 1 MiB

export interface ReadBodyLimitResult {
  ok: boolean;
  body?: string;
  errorResponse?: NextResponse;
}

/**
 * Safely reads the request body stream with a strict byte limit (default 1 MiB).
 * Bails out immediately if Content-Length exceeds limit or if stream exceeds limit,
 * safely cancelling the underlying reader to avoid unbounded memory consumption.
 */
export async function readRequestBodyWithLimit(
  req: NextRequest,
  maxBytes: number = MAX_BFF_BODY_BYTES
): Promise<ReadBodyLimitResult> {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return { ok: true, body: undefined };
  }

  // 1. Fast rejection if Content-Length header is present, valid integer, and exceeds limit
  const clHeader = req.headers.get('content-length');
  if (clHeader !== null && clHeader !== '') {
    const parsedCl = parseInt(clHeader, 10);
    if (!Number.isNaN(parsedCl) && parsedCl > maxBytes) {
      if (req.body && typeof (req.body as any).getReader === 'function') {
        try {
          const reader = req.body.getReader();
          await reader.cancel('PAYLOAD_TOO_LARGE');
        } catch {
          // ignore stream cancellation error
        }
      }
      return {
        ok: false,
        errorResponse: NextResponse.json(
          {
            error: {
              code: 'PAYLOAD_TOO_LARGE',
              message: 'Ukuran payload request melebihi batas maksimal 1 MiB.',
            },
          },
          { status: 413 }
        ),
      };
    }
  }

  // 2. If no body stream is available
  if (!req.body) {
    return { ok: true, body: undefined };
  }

  // 3. Fallback for non-standard ReadableStream
  if (typeof req.body.getReader !== 'function') {
    try {
      const text = await req.text();
      const byteLen = Buffer.byteLength(text, 'utf-8');
      if (byteLen > maxBytes) {
        return {
          ok: false,
          errorResponse: NextResponse.json(
            {
              error: {
                code: 'PAYLOAD_TOO_LARGE',
                message: 'Ukuran payload request melebihi batas maksimal 1 MiB.',
              },
            },
            { status: 413 }
          ),
        };
      }
      return { ok: true, body: text };
    } catch {
      return {
        ok: false,
        errorResponse: NextResponse.json(
          {
            error: {
              code: 'REQUEST_STREAM_ERROR',
              message: 'Gagal membaca stream request body.',
            },
          },
          { status: 400 }
        ),
      };
    }
  }

  // 4. Stream-bounded reader: read chunk by chunk up to maxBytes
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          try {
            await reader.cancel('PAYLOAD_TOO_LARGE');
          } catch {
            // ignore stream cancellation error
          }
          return {
            ok: false,
            errorResponse: NextResponse.json(
              {
                error: {
                  code: 'PAYLOAD_TOO_LARGE',
                  message: 'Ukuran payload request melebihi batas maksimal 1 MiB.',
                },
              },
              { status: 413 }
            ),
          };
        }
        chunks.push(value);
      }
    }
  } catch {
    return {
      ok: false,
      errorResponse: NextResponse.json(
        {
          error: {
            code: 'REQUEST_STREAM_ERROR',
            message: 'Gagal membaca stream request body.',
          },
        },
        { status: 400 }
      ),
    };
  }

  if (chunks.length === 0) {
    return { ok: true, body: '' };
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, body: new TextDecoder('utf-8').decode(combined) };
}

export type BffRouteContext = {
  params: Promise<{ path?: string[] }>;
};

export function createBffProxyHandler(apiBasePath: string) {
  return async function handleProxy(
    req: NextRequest,
    { params }: BffRouteContext
  ): Promise<NextResponse> {
    const csrfCheck = validateCsrfOrigin(req);
    if (!csrfCheck.valid) {
      return NextResponse.json(
        {
          error: {
            code: 'CSRF_ORIGIN_INVALID',
            message: csrfCheck.reason || 'Permintaan ditolak: CSRF terdeteksi',
          },
        },
        { status: 403 }
      );
    }

    const { path } = await params;
    if (
      path &&
      path.some(
        (seg) =>
          !seg ||
          seg === '.' ||
          seg === '..' ||
          seg.includes('/') ||
          seg.includes('\\')
      )
    ) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_PATH',
            message: 'Path permintaan tidak valid',
          },
        },
        { status: 400 }
      );
    }
    const subPath =
      path && path.length > 0
        ? path.map((seg) => encodeURIComponent(seg)).join('/')
        : '';
    const search = req.nextUrl.search;

    let internalApiUrl: string;
    try {
      internalApiUrl = getInternalApiUrl();
    } catch (configErr) {
      console.error(
        `[BFF Configuration Error] ${configErr instanceof Error ? configErr.message : 'Invalid API configuration'}`
      );
      return NextResponse.json(
        {
          error: {
            code: 'API_CONFIGURATION_ERROR',
            message:
              'Konfigurasi server API tidak valid atau belum disetel pada lingkungan ini.',
          },
        },
        { status: 500 }
      );
    }

    const targetUrl = `${internalApiUrl}${apiBasePath}${subPath ? `/${subPath}` : ''}${search}`;

    const requestHeaders = new Headers();
    requestHeaders.set('Content-Type', 'application/json');

    const cookieHeader = req.headers.get('cookie');
    if (cookieHeader) {
      requestHeaders.set('cookie', cookieHeader);
    }

    const authHeader = req.headers.get('authorization');
    if (authHeader) {
      requestHeaders.set('authorization', authHeader);
    }

    const origin = req.headers.get('origin');
    if (origin) {
      requestHeaders.set('origin', origin);
    }
    const referer = req.headers.get('referer');
    if (referer) {
      requestHeaders.set('referer', referer);
    }

    const requestId = req.headers.get('x-request-id') || crypto.randomUUID();
    requestHeaders.set('x-request-id', requestId);

    const trustedClientIp = resolveForwardedClientIp(req.headers);
    requestHeaders.set('x-forwarded-for', trustedClientIp);

    const bodyResult = await readRequestBodyWithLimit(req);
    if (!bodyResult.ok && bodyResult.errorResponse) {
      return bodyResult.errorResponse;
    }
    const body = bodyResult.body;

    try {
      const expressRes = await fetch(targetUrl, {
        method: req.method,
        headers: requestHeaders,
        body,
        cache: 'no-store',
      });

      const responseData = await expressRes.text();

      const responseHeaders = new Headers();
      responseHeaders.set(
        'Content-Type',
        expressRes.headers.get('content-type') || 'application/json'
      );

      for (const headerName of RATE_LIMIT_HEADERS) {
        const val = expressRes.headers.get(headerName);
        if (val !== null) {
          responseHeaders.set(headerName, val);
        }
      }

      const response = new NextResponse(responseData, {
        status: expressRes.status,
        headers: responseHeaders,
      });

      const setCookieHeaders = expressRes.headers.getSetCookie?.() ?? [];
      for (const cookieStr of setCookieHeaders) {
        response.headers.append('set-cookie', cookieStr);
      }

      return response;
    } catch (err) {
      const safeTargetUrl = sanitizeLogUrl(targetUrl);
      const rawErrorMsg = err instanceof Error ? err.message : String(err);
      const safeErrorMsg = sanitizeLogText(rawErrorMsg);

      console.error(
        `[BFF Proxy Error] ${req.method} ${safeTargetUrl} failed:`,
        safeErrorMsg
      );
      return NextResponse.json(
        {
          error: {
            code: 'BACKEND_UNAVAILABLE',
            message:
              'Layanan backend sedang tidak dapat dihubungi. Silakan coba beberapa saat lagi.',
          },
        },
        { status: 503 }
      );
    }
  };
}
