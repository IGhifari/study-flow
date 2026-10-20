import { NextRequest, NextResponse } from 'next/server';
import { resolveForwardedClientIp } from './clientIp';
import { getInternalApiUrl } from './api-config';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const RATE_LIMIT_HEADERS = [
  'retry-after',
  'ratelimit-limit',
  'ratelimit-remaining',
  'ratelimit-reset',
  'ratelimit-policy',
] as const;

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
    const subPath = path && path.length > 0 ? path.join('/') : '';
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

    let body: string | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      try {
        body = await req.text();
      } catch {
        body = undefined;
      }
    }

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
      console.error(
        `[BFF Proxy Error] ${req.method} ${targetUrl} failed:`,
        err instanceof Error ? err.message : err
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
