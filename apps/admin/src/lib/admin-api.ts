import {
  AdminLoginInput,
  AdminSummary,
  AdminUserListQuery,
  AdminUserListResponse,
  UserProfile,
} from '@studyflow/shared';

export class AdminApiError extends Error {
  statusCode: number;
  code?: string;
  details?: Record<string, string[]>;

  constructor(message: string, statusCode: number, code?: string, details?: Record<string, string[]>) {
    super(message);
    this.name = 'AdminApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorJson: any = null;
    try {
      errorJson = await res.json();
    } catch {
      // response wasn't JSON
    }

    const message =
      errorJson?.error?.message ||
      errorJson?.message ||
      `Permintaan gagal dengan status ${res.status}`;
    const code = errorJson?.error?.code || errorJson?.code;
    const details = errorJson?.error?.details;

    throw new AdminApiError(message, res.status, code, details);
  }

  return res.json();
}

export async function fetchAdminMe(): Promise<{ user: UserProfile }> {
  const res = await fetch('/api/admin/auth/me', {
    method: 'GET',
    cache: 'no-store',
  });
  return handleResponse<{ user: UserProfile }>(res);
}

export async function loginAdminApi(input: AdminLoginInput): Promise<{ message: string; user: UserProfile }> {
  const res = await fetch('/api/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return handleResponse<{ message: string; user: UserProfile }>(res);
}

export async function logoutAdminApi(): Promise<{ message: string }> {
  const res = await fetch('/api/admin/auth/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return handleResponse<{ message: string }>(res);
}

export async function fetchAdminSummary(): Promise<AdminSummary> {
  const res = await fetch('/api/admin/summary', {
    method: 'GET',
    cache: 'no-store',
  });
  return handleResponse<AdminSummary>(res);
}

export async function fetchAdminUsers(query: Partial<AdminUserListQuery> = {}): Promise<AdminUserListResponse> {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.search) params.set('search', query.search);
  if (query.sortBy) params.set('sortBy', query.sortBy);
  if (query.sortOrder) params.set('sortOrder', query.sortOrder);

  const res = await fetch(`/api/admin/users?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
  });
  return handleResponse<AdminUserListResponse>(res);
}
