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

// Queue to handle multiple concurrent refresh requests across student and admin clients
let isRefreshing = false;
let refreshSubscribers: ((ok: boolean) => void)[] = [];

function onTokenRefreshed(ok: boolean) {
  refreshSubscribers.forEach((cb) => cb(ok));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb: (ok: boolean) => void) {
  refreshSubscribers.push(cb);
}

export async function refreshAccessToken(): Promise<boolean> {
  if (!isRefreshing) {
    isRefreshing = true;
    try {
      const refreshRes = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      const ok = refreshRes.ok;
      isRefreshing = false;
      onTokenRefreshed(ok);
      return ok;
    } catch {
      isRefreshing = false;
      onTokenRefreshed(false);
      return false;
    }
  }

  return new Promise<boolean>((resolve) => {
    addRefreshSubscriber(resolve);
  });
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

  // If unauthorized and not already calling refresh/login/register
  if (
    response.status === 401 &&
    !url.includes('/api/auth/refresh') &&
    !url.includes('/api/auth/login') &&
    !url.includes('/api/auth/register')
  ) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return fetch(url, {
        ...options,
        headers,
        credentials: 'include',
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

export interface ApiError extends Error {
  code?: string;
  details?: { requireCaptcha?: boolean } & Record<string, unknown>;
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof Error;
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
    const error: ApiError = new Error(data.error?.message || 'Login gagal');
    error.code = data.error?.code;
    error.details = data.error?.details;
    throw error;
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

export async function apiGetProfile(): Promise<UserProfile> {
  const res = await authFetch('/api/auth/me');
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Gagal memuat profil');
  }
  return data.user;
}

export const getProfile = apiGetProfile;

export async function getGoogleAuthStatus(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/google/status', { cache: 'no-store' });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.configured);
  } catch {
    return false;
  }
}

export async function initiateGoogleLink(currentPassword: string): Promise<{ url: string }> {
  const res = await fetch('/api/auth/google/link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword }),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Gagal memulai pengaitan akun Google');
  }

  return data;
}

export async function apiForgotPassword(email: string, turnstileToken?: string): Promise<{ message: string }> {
  const res = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, turnstileToken }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Gagal memproses permintaan reset password');
  }

  return data;
}

export async function apiResetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  const res = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Gagal mengatur ulang kata sandi');
  }

  return data;
}

export async function apiRequestEmailVerification(): Promise<{ message: string }> {
  const res = await authFetch('/api/auth/verify-email/request', {
    method: 'POST',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Gagal mengirim email verifikasi');
  }

  return data;
}

export async function apiConfirmEmailVerification(token: string): Promise<{ message: string; user?: UserProfile }> {
  const res = await fetch('/api/auth/verify-email/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Gagal memverifikasi alamat email');
  }

  return data;
}



