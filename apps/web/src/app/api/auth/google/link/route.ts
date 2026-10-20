import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAMES } from '@studyflow/shared';
import { getInternalApiUrl } from '@/lib/api-config';

export async function POST(req: NextRequest) {
  // Validate CSRF / Origin
  const origin = req.headers.get('origin');
  const normalizedOrigin = origin ? origin.replace(/\/+$/, '') : null;
  const normalizedTrustedOrigin = req.nextUrl.origin.replace(/\/+$/, '');

  const allowedOrigins = new Set<string>([
    req.nextUrl.origin,
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

  if (!origin || (!allowedOrigins.has(origin) && !allowedOrigins.has(normalizedOrigin!))) {
    return NextResponse.json(
      { error: { message: 'Origin tidak diizinkan atau CSRF terdeteksi' } },
      { status: 403 }
    );
  }

  let body: { currentPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { message: 'Body request tidak valid' } },
      { status: 400 }
    );
  }

  const requestHeaders = new Headers();
  requestHeaders.set('Content-Type', 'application/json');
  requestHeaders.set('Origin', req.nextUrl.origin);

  // Forward cookies from browser to Express (authentication session)
  const cookieHeader = req.headers.get('cookie');
  if (cookieHeader) {
    requestHeaders.set('cookie', cookieHeader);
  }

  try {
    const internalApiUrl = getInternalApiUrl();
    const apiRes = await fetch(`${internalApiUrl}/api/auth/google/link/init`, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const data = await apiRes.json();
    if (!apiRes.ok) {
      return NextResponse.json(data, { status: apiRes.status });
    }

    const { url, state, nonce, codeVerifier, userId } = data as {
      url: string;
      state: string;
      nonce: string;
      codeVerifier: string;
      userId: string;
    };

    // Store transient linking transaction in secure HttpOnly cookie
    const txData = JSON.stringify({
      state,
      nonce,
      codeVerifier,
      returnUrl: '/settings',
      intent: 'link',
      userId,
      createdAt: Date.now(),
    });

    const isSecure = req.nextUrl.protocol === 'https:' || process.env.NODE_ENV === 'production';

    const response = NextResponse.json({ url });
    response.cookies.set(COOKIE_NAMES.oauthTx, txData, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: 600, // 10 minutes
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: { message: 'Gagal menghubungi server untuk memulai pengaitan Google' } },
      { status: 500 }
    );
  }
}
