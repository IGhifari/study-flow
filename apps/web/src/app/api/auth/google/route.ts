import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAMES } from '@studyflow/shared';
import { getSafeReturnUrl } from '@/lib/auth-client';
import { getInternalApiUrl } from '@/lib/api-config';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const rawReturnUrl = searchParams.get('returnUrl');
  const returnUrl = getSafeReturnUrl(rawReturnUrl, '/dashboard');

  try {
    const callbackRedirectUri = `${req.nextUrl.origin}/api/auth/google/callback`;

    const internalApiUrl = getInternalApiUrl();
    // Request fresh OAuth URL & PKCE challenge from Express API
    const targetUrl = new URL(`${internalApiUrl}/api/auth/google/url`);
    targetUrl.searchParams.set('redirectUri', callbackRedirectUri);

    const apiRes = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!apiRes.ok) {
      const errorData = await apiRes.json().catch(() => ({}));
      const message = errorData.error?.message || 'Layanan Google OAuth sedang tidak tersedia';
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(message)}`, req.nextUrl.origin)
      );
    }

    const { url, state, nonce, codeVerifier } = (await apiRes.json()) as {
      url: string;
      state: string;
      nonce: string;
      codeVerifier: string;
    };

    // Store transient OAuth transaction state in secure HttpOnly cookie
    const txData = JSON.stringify({
      state,
      nonce,
      codeVerifier,
      returnUrl,
      intent: 'login',
      createdAt: Date.now(),
    });

    const isSecure = req.nextUrl.protocol === 'https:' || process.env.NODE_ENV === 'production';

    const response = NextResponse.redirect(url);
    response.cookies.set(COOKIE_NAMES.oauthTx, txData, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax', // Required so cookie is attached upon GET redirection from Google
      path: '/',
      maxAge: 600, // 10 minutes
    });

    return response;
  } catch {
    return NextResponse.redirect(
      new URL('/login?error=oauth_init_failed', req.nextUrl.origin)
    );
  }
}
