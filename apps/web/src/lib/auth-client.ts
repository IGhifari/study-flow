import {
  UserProfile,
  RegisterInput,
  LoginInput,
  UpdateProfileInput,
  ChangePasswordInput,
} from '@studyflow/shared';

export function getSafeReturnUrl(url: string | null | undefined, defaultUrl = '/dashboard'): string {
  if (!url || typeof url !== 'string') return defaultUrl;
  if (url.startsWith('/') && !url.startsWith('//') && !url.includes('\\')) {
    return url;
  }
  return defaultUrl;
}

// Queue to handle multiple concurrent refresh requests
let isRefreshing = false;
let refreshSubscribers: ((ok: boolean) => void)[] = [];

function onTokenRefreshed(ok: boolean) {
  refreshSubscribers.forEach((cb) => cb(ok));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb: (ok: boolean) => void) {
  refreshSubscribers.push(cb);
}

export async function authFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = endpoint.startsWith('/') ? endpoint : `/api/auth/${endpoint}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  // If unauthorized and not already refreshing or calling refresh/login
  if (
    response.status === 401 &&
    !url.includes('/api/auth/refresh') &&
    !url.includes('/api/auth/login') &&
    !url.includes('/api/auth/register')
  ) {
    if (!isRefreshing) {
      isRefreshing = true;

      try {
        const refreshRes = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });

        if (refreshRes.ok) {
          isRefreshing = false;
          onTokenRefreshed(true);
          // Retry original request
          return fetch(url, {
            ...options,
            headers,
            credentials: 'include',
          });
        } else {
          isRefreshing = false;
          onTokenRefreshed(false);
          return response;
        }
      } catch {
        isRefreshing = false;
        onTokenRefreshed(false);
        return response;
      }
    } else {
      // Wait for ongoing refresh
      return new Promise<Response>((resolve) => {
        addRefreshSubscriber(async (ok) => {
          if (ok) {
            const retryRes = await fetch(url, {
              ...options,
              headers,
              credentials: 'include',
            });
            resolve(retryRes);
          } else {
            resolve(response);
          }
        });
      });
    }
  }

  return response;
}

export async function getCurrentUser(): Promise<UserProfile | null> {
  try {
    const res = await authFetch('/api/auth/me');
    if (!res.ok) return null;
    const data = await res.json();
    return data.user || null;
  } catch {
    return null;
  }
}

export async function apiRegister(input: RegisterInput): Promise<{ user: UserProfile }> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Registrasi gagal');
  }

  return data;
}

export async function apiLogin(input: LoginInput): Promise<{ user: UserProfile }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Login gagal');
  }

  return data;
}

export async function apiLogout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } finally {
    // Clear any client caches
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
    }
  }
}

export async function apiUpdateProfile(input: UpdateProfileInput): Promise<UserProfile> {
  const res = await authFetch('/api/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Gagal memperbarui profil');
  }

  return data.user;
}

export async function apiChangePassword(input: ChangePasswordInput): Promise<string> {
  const res = await authFetch('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Gagal mengganti password');
  }

  return data.message;
}
