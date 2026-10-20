import { cookies } from 'next/headers';
import { COOKIE_NAMES, UserProfile } from '@studyflow/shared';
import { getInternalApiUrl, ApiConfigurationError } from './api-config';

export async function getServerSessionUser(): Promise<UserProfile | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(COOKIE_NAMES.accessToken)?.value;
  const refreshToken = cookieStore.get(COOKIE_NAMES.refreshToken)?.value;

  if (!accessToken && !refreshToken) {
    return null;
  }

  const cookieHeader = cookieStore.toString();

  try {
    const internalApiUrl = getInternalApiUrl();
    const res = await fetch(`${internalApiUrl}/api/auth/me`, {
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
  } catch (err) {
    if (err instanceof ApiConfigurationError) {
      console.error('[ServerSession API Configuration Error]', err.message);
    }
    return null;
  }
}
