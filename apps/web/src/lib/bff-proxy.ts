import { NextRequest, NextResponse } from 'next/server';
import { resolveForwardedClientIp } from './clientIp';

const INTERNAL_API_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:4000';

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
  if (requestOrigin !== trustedOrigin) {
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
    const targetUrl = `${INTERNAL_API_URL}${apiBasePath}${subPath ? `/${subPath}` : ''}${search}`;

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
