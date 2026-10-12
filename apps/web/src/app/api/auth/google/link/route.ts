import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAMES } from '@studyflow/shared';

const INTERNAL_API_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:4000';

export async function POST(req: NextRequest) {
  // Validate CSRF / Origin
  const origin = req.headers.get('origin');
  if (origin !== req.nextUrl.origin) {
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
    const apiRes = await fetch(`${INTERNAL_API_URL}/api/auth/google/link/init`, {
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
