import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAMES, OAuthTransactionCookieSchema, OAuthTransactionCookie } from '@studyflow/shared';
import { getSafeReturnUrl } from '@/lib/auth-client';
import { getInternalApiUrl } from '@/lib/api-config';
import { resolveForwardedClientIp } from '@/lib/bff-proxy';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');

  // 1. Read transient transaction cookie
  const txCookieRaw = req.cookies.get(COOKIE_NAMES.oauthTx)?.value;

  // Prepare a base response helper that ensures transaction cookie is always cleared
  const clearCookieOptions = {
    path: '/',
    maxAge: 0,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: req.nextUrl.protocol === 'https:' || process.env.NODE_ENV === 'production',
  };

  if (!txCookieRaw) {
    const errorMsg = 'Sesi transaksi login kedaluwarsa atau tidak ditemukan. Silakan coba kembali.';
    const res = NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorMsg)}`, req.nextUrl.origin)
    );
    res.cookies.set(COOKIE_NAMES.oauthTx, '', clearCookieOptions);
    return res;
  }

  let tx: OAuthTransactionCookie;
  try {
    const parsedJson = JSON.parse(txCookieRaw);
    const parsed = OAuthTransactionCookieSchema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new Error('Skema transaksi tidak valid');
    }
    tx = parsed.data;
  } catch {
    const errorMsg = 'Data transaksi OAuth rusak atau tidak valid. Silakan coba kembali.';
    const res = NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorMsg)}`, req.nextUrl.origin)
    );
    res.cookies.set(COOKIE_NAMES.oauthTx, '', clearCookieOptions);
    return res;
  }

  const errorRedirectBase = tx.intent === 'link' ? '/settings' : '/login';

  // 2. Handle provider cancellation or denial (e.g. error=access_denied)
  if (errorParam) {
    const isCancelled = errorParam === 'access_denied';
    const message = isCancelled
      ? 'Otorisasi masuk dengan Google dibatalkan.'
      : 'Terjadi kesalahan saat otorisasi dengan akun Google.';
    const res = NextResponse.redirect(
      new URL(`${errorRedirectBase}?error=${encodeURIComponent(message)}`, req.nextUrl.origin)
    );
    res.cookies.set(COOKIE_NAMES.oauthTx, '', clearCookieOptions);
    return res;
  }

  // 3. Handle missing code or state
  if (!code || !state) {
    const message = 'Parameter otorisasi Google tidak lengkap.';
    const res = NextResponse.redirect(
      new URL(`${errorRedirectBase}?error=${encodeURIComponent(message)}`, req.nextUrl.origin)
    );
    res.cookies.set(COOKIE_NAMES.oauthTx, '', clearCookieOptions);
    return res;
  }

  // 4. Validate State (Anti-CSRF Protection)
  if (state !== tx.state) {
    const message = 'State transaksi tidak cocok. Permintaan ditolak demi keamanan (CSRF terdeteksi).';
    const res = NextResponse.redirect(
      new URL(`${errorRedirectBase}?error=${encodeURIComponent(message)}`, req.nextUrl.origin)
    );
    res.cookies.set(COOKIE_NAMES.oauthTx, '', clearCookieOptions);
    return res;
  }

  // 5. Exchange code via Express API
  const callbackRedirectUri = `${req.nextUrl.origin}/api/auth/google/callback`;

  const requestHeaders = new Headers();
  requestHeaders.set('Content-Type', 'application/json');
  requestHeaders.set('Origin', req.nextUrl.origin);
  requestHeaders.set('x-forwarded-for', resolveForwardedClientIp(req.headers));

  // Forward existing auth cookies from browser to Express (necessary for linking intent)
  const cookieHeader = req.headers.get('cookie');
  if (cookieHeader) {
    requestHeaders.set('cookie', cookieHeader);
  }

  try {
    const internalApiUrl = getInternalApiUrl();
    const expressRes = await fetch(`${internalApiUrl}/api/auth/google/exchange`, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify({
        code,
        codeVerifier: tx.codeVerifier,
        nonce: tx.nonce,
        redirectUri: callbackRedirectUri,
        intent: tx.intent,
      }),
      cache: 'no-store',
    });

    if (!expressRes.ok) {
      const errorData = (await expressRes.json().catch(() => ({}))) as {
        error?: { message?: string; code?: string };
      };
      const errorMessage =
        errorData.error?.message || 'Gagal menyelesaikan autentikasi dengan akun Google.';

      const res = NextResponse.redirect(
        new URL(`${errorRedirectBase}?error=${encodeURIComponent(errorMessage)}`, req.nextUrl.origin)
      );
      res.cookies.set(COOKIE_NAMES.oauthTx, '', clearCookieOptions);
      return res;
    }

    // 6. Handle Success Redirect
    const successTarget =
      tx.intent === 'link'
        ? `${req.nextUrl.origin}/settings?google=linked`
        : `${req.nextUrl.origin}${getSafeReturnUrl(tx.returnUrl, '/dashboard')}`;

    const response = NextResponse.redirect(new URL(successTarget));

    // Clear the transaction cookie atomically
    response.cookies.set(COOKIE_NAMES.oauthTx, '', clearCookieOptions);

    // Forward Set-Cookie headers from Express to browser (access token, refresh token)
    const setCookieHeaders =
      typeof expressRes.headers.getSetCookie === 'function'
        ? expressRes.headers.getSetCookie()
        : [];
    if (setCookieHeaders && setCookieHeaders.length > 0) {
      for (const cookieStr of setCookieHeaders) {
        response.headers.append('set-cookie', cookieStr);
      }
    }

    return response;
  } catch {
    const message = 'Gagal menghubungi server aplikasi saat menyelesaikan login Google.';
    const res = NextResponse.redirect(
      new URL(`${errorRedirectBase}?error=${encodeURIComponent(message)}`, req.nextUrl.origin)
    );
    res.cookies.set(COOKIE_NAMES.oauthTx, '', clearCookieOptions);
    return res;
  }
}
