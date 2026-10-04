import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_NAMES } from '@studyflow/shared';

const INTERNAL_API_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:4000';

const PROTECTED_PREFIXES = ['/dashboard', '/settings'];
const AUTH_PREFIXES = ['/login', '/register'];

function isValidReturnUrl(url: string | null): boolean {
  if (!url) return false;
  return url.startsWith('/') && !url.startsWith('//') && !url.includes('\\');
}

function isJwtExpired(token: string | undefined): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const jsonStr = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(jsonStr);
    if (!payload.exp || typeof payload.exp !== 'number') return true;
    // Expired or expiring within 10 seconds
    return payload.exp * 1000 <= Date.now() + 10_000;
  } catch {
    return true;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const accessToken = req.cookies.get(COOKIE_NAMES.accessToken)?.value;
  const refreshToken = req.cookies.get(COOKIE_NAMES.refreshToken)?.value;

  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isAuthRoute = AUTH_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  // 1. Direct access to protected routes
  if (isProtectedRoute) {
    const accessExpired = isJwtExpired(accessToken);

    // If access token is valid, proceed immediately
    if (accessToken && !accessExpired) {
      return NextResponse.next();
    }

    // If access token is expired or missing, but refresh token exists:
    // Seamlessly refresh session before serving the protected page
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${INTERNAL_API_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: {
            cookie: `${COOKIE_NAMES.refreshToken}=${refreshToken}`,
            'Content-Type': 'application/json',
            origin: req.nextUrl.origin,
          },
          cache: 'no-store',
        });

        if (refreshRes.ok) {
          const setCookies = refreshRes.headers.getSetCookie();
          const newCookieStrings: string[] = [];

          // Create new request headers with refreshed cookies for Server Components
          const reqCookieMap = new Map<string, string>();
          req.cookies.getAll().forEach((c) => reqCookieMap.set(c.name, c.value));

          for (const headerStr of setCookies) {
            const [cookiePart] = headerStr.split(';');
            const [cName, cVal] = cookiePart.split('=');
            if (cName && cVal) {
              reqCookieMap.set(cName.trim(), cVal.trim());
            }
          }

          const combinedCookieHeader = Array.from(reqCookieMap.entries())
            .map(([k, v]) => `${k}=${v}`)
            .join('; ');

          const forwardHeaders = new Headers(req.headers);
          forwardHeaders.set('cookie', combinedCookieHeader);

          const response = NextResponse.next({
            request: {
              headers: forwardHeaders,
            },
          });

          // Forward refreshed cookies to browser
          for (const cookieStr of setCookies) {
            response.headers.append('set-cookie', cookieStr);
          }

          return response;
        }
      } catch {
        // Fallthrough to redirect
      }
    }

    // Refresh failed or no credentials: clean up and redirect to login
    const returnUrl = encodeURIComponent(pathname + search);
    const loginUrl = new URL(`/login?returnUrl=${returnUrl}`, req.url);
    const redirectRes = NextResponse.redirect(loginUrl);
    redirectRes.cookies.delete(COOKIE_NAMES.accessToken);
    redirectRes.cookies.delete(COOKIE_NAMES.refreshToken);
    return redirectRes;
  }

  // 2. Access to auth routes (/login, /register)
  if (isAuthRoute) {
    const accessExpired = isJwtExpired(accessToken);
    const hasValidSession = (accessToken && !accessExpired) || !!refreshToken;

    if (hasValidSession) {
      const queryReturnUrl = req.nextUrl.searchParams.get('returnUrl');
      const targetPath = isValidReturnUrl(queryReturnUrl) ? queryReturnUrl! : '/dashboard';
      return NextResponse.redirect(new URL(targetPath, req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/settings/:path*',
    '/login',
    '/register',
  ],
};
