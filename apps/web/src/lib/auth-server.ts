import { cookies } from 'next/headers';
import { COOKIE_NAMES, UserProfile } from '@studyflow/shared';

const INTERNAL_API_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:4000';

export async function getServerSessionUser(): Promise<UserProfile | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(COOKIE_NAMES.accessToken)?.value;
  const refreshToken = cookieStore.get(COOKIE_NAMES.refreshToken)?.value;

  if (!accessToken && !refreshToken) {
    return null;
  }

  const cookieHeader = cookieStore.toString();

  try {
    const res = await fetch(`${INTERNAL_API_URL}/api/auth/me`, {
      headers: {
        cookie: cookieHeader,
      },
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();
      return data.user || null;
    }

    return null;
  } catch {
    return null;
  }
}
