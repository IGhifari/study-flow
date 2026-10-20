import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAMES } from '@studyflow/shared';
import { resolveForwardedClientIp } from '@/lib/clientIp';

const INTERNAL_API_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:4000';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function validateCsrfOrigin(req: NextRequest): { valid: boolean; reason?: string } {
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

  // 2. Reject missing Origin & Referer on mutations
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

function filterAdminCookies(cookieHeader: string | null): string {
  if (!cookieHeader) return '';
  const cookies = cookieHeader.split(';').map((c) => c.trim());
  const allowed = [
    ADMIN_COOKIE_NAMES.accessToken,
    ADMIN_COOKIE_NAMES.refreshToken,
  ];
  return cookies
    .filter((c) => allowed.some((name) => c.startsWith(`${name}=`)))
    .join('; ');
}

async function handleProxy(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  // Validate Origin/CSRF before proxying state-changing requests
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
  if (!path || path.length === 0 || path[0] !== 'admin') {
    return NextResponse.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Rute tidak ditemukan pada portal administrator',
        },
      },
      { status: 404 }
    );
  }

  const targetPath = path.join('/');
  const search = req.nextUrl.search;
  const targetUrl = `${INTERNAL_API_URL}/api/${targetPath}${search}`;

  const requestHeaders = new Headers();
  requestHeaders.set('Content-Type', 'application/json');

  // Strictly forward ONLY admin cookies, preventing web session leakage or crosstalk
  const rawCookieHeader = req.headers.get('cookie');
  const adminCookies = filterAdminCookies(rawCookieHeader);
  if (adminCookies) {
    requestHeaders.set('cookie', adminCookies);
  }

  // Forward authorization header if present
  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    requestHeaders.set('authorization', authHeader);
  }

  // Forward client Origin and Referer transparently
  const origin = req.headers.get('origin');
  if (origin) {
    requestHeaders.set('origin', origin);
  }
  const referer = req.headers.get('referer');
  if (referer) {
    requestHeaders.set('referer', referer);
  }

  // Forward client request ID
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();
  requestHeaders.set('x-request-id', requestId);

  // Forward client IP
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
    // Explicitly prevent public or browser caching of admin data
    responseHeaders.set('Cache-Control', 'no-store, private');

    // Forward standard rate-limit and retry headers
    const rateLimitHeaders = [
      'retry-after',
      'ratelimit-limit',
      'ratelimit-remaining',
      'ratelimit-reset',
      'ratelimit-policy',
    ];
    for (const h of rateLimitHeaders) {
      const val = expressRes.headers.get(h);
      if (val !== null) {
        responseHeaders.set(h, val);
      }
    }

    const response = new NextResponse(responseData, {
      status: expressRes.status,
      headers: responseHeaders,
    });

    // Forward Set-Cookie headers from Express to Browser
    const setCookieHeaders = expressRes.headers.getSetCookie();
    if (setCookieHeaders && setCookieHeaders.length > 0) {
      for (const cookieStr of setCookieHeaders) {
        response.headers.append('set-cookie', cookieStr);
      }
    }

    return response;
  } catch (err) {
    console.error(
      `[Admin BFF Error] ${req.method} ${targetUrl} failed:`,
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
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const PATCH = handleProxy;
export const DELETE = handleProxy;
