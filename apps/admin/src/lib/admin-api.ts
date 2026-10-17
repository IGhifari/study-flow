import {
  AdminLoginInput,
  AdminSummary,
  AdminUserListQuery,
  AdminUserListResponse,
  AdminUserDetail,
  AdminJobListQuery,
  AdminJobListResponse,
  AdminJobDetail,
  AdminQueuesSummaryResponse,
  AdminTrendRange,
  AdminTrendsResponse,
  AdminSystemStatusResponse,
  AdminSystemModule,
  AdminCourseListQuery,
  AdminCourseListResponse,
  AdminMaterialListQuery,
  AdminMaterialListResponse,
  AdminAssignmentListQuery,
  AdminAssignmentListResponse,
  AdminNoteListQuery,
  AdminNoteListResponse,
  AdminScheduleListQuery,
  AdminScheduleListResponse,
  AdminQuizListQuery,
  AdminQuizListResponse,
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

export async function adminFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = endpoint;

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  // If unauthorized and not already refreshing or calling auth endpoints
  if (
    response.status === 401 &&
    !url.includes('/api/admin/auth/refresh') &&
    !url.includes('/api/admin/auth/login') &&
    !url.includes('/api/admin/auth/logout')
  ) {
    if (!isRefreshing) {
      isRefreshing = true;

      try {
        const refreshRes = await fetch('/api/admin/auth/refresh', {
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

export async function fetchAdminMe(
  options?: { signal?: AbortSignal }
): Promise<{ user: UserProfile }> {
  const res = await adminFetch('/api/admin/auth/me', {
    method: 'GET',
    cache: 'no-store',
    signal: options?.signal,
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

export async function fetchAdminSummary(
  options?: { signal?: AbortSignal }
): Promise<AdminSummary> {
  const res = await adminFetch('/api/admin/summary', {
    method: 'GET',
    cache: 'no-store',
    signal: options?.signal,
  });
  return handleResponse<AdminSummary>(res);
}

export async function fetchAdminUsers(
  query: Partial<AdminUserListQuery> = {},
  options?: { signal?: AbortSignal }
): Promise<AdminUserListResponse> {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.search) params.set('search', query.search);
  if (query.sortBy) params.set('sortBy', query.sortBy);
  if (query.sortOrder) params.set('sortOrder', query.sortOrder);

  const res = await adminFetch(`/api/admin/users?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
    signal: options?.signal,
  });
  return handleResponse<AdminUserListResponse>(res);
}

export async function fetchAdminUserDetail(
  userId: string,
  options?: { signal?: AbortSignal }
): Promise<AdminUserDetail> {
  const res = await adminFetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: 'GET',
    cache: 'no-store',
    signal: options?.signal,
  });
  return handleResponse<AdminUserDetail>(res);
}

export async function fetchAdminJobs(
  query: Partial<AdminJobListQuery> = {},
  options?: { signal?: AbortSignal }
): Promise<AdminJobListResponse> {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.type) params.set('type', query.type);
  if (query.status) params.set('status', query.status);
  if (query.userId) params.set('userId', query.userId);
  if (query.jobId) params.set('jobId', query.jobId);
  if (query.search) params.set('search', query.search);
  if (query.startDate) params.set('startDate', query.startDate);
  if (query.endDate) params.set('endDate', query.endDate);
  if (query.sortBy) params.set('sortBy', query.sortBy);
  if (query.sortOrder) params.set('sortOrder', query.sortOrder);

  const res = await adminFetch(`/api/admin/jobs?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
    signal: options?.signal,
  });
  return handleResponse<AdminJobListResponse>(res);
}

export async function fetchAdminJobDetail(
  jobId: string,
  options?: { signal?: AbortSignal }
): Promise<AdminJobDetail> {
  const res = await adminFetch(`/api/admin/jobs/${encodeURIComponent(jobId)}`, {
    method: 'GET',
    cache: 'no-store',
    signal: options?.signal,
  });
  return handleResponse<AdminJobDetail>(res);
}

export async function fetchAdminQueuesSummary(
  options?: { signal?: AbortSignal }
): Promise<AdminQueuesSummaryResponse> {
  const res = await adminFetch('/api/admin/jobs/queues/summary', {
    method: 'GET',
    cache: 'no-store',
    signal: options?.signal,
  });
  return handleResponse<AdminQueuesSummaryResponse>(res);
}

export async function fetchAdminTrends(
  range: AdminTrendRange = '30d',
  options?: { signal?: AbortSignal }
): Promise<AdminTrendsResponse> {
  const params = new URLSearchParams({ range });
  const res = await adminFetch(`/api/admin/trends?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
    signal: options?.signal,
  });
  return handleResponse<AdminTrendsResponse>(res);
}

export async function fetchAdminSystemStatus(
  options?: { signal?: AbortSignal }
): Promise<AdminSystemStatusResponse> {
  const res = await adminFetch('/api/admin/system/status', {
    method: 'GET',
    cache: 'no-store',
    signal: options?.signal,
  });
  return handleResponse<AdminSystemStatusResponse>(res);
}

export async function fetchAdminCourses(
  query: Partial<AdminCourseListQuery> = {},
  options?: { signal?: AbortSignal }
): Promise<AdminCourseListResponse> {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.search) params.set('search', query.search);
  if (query.sortBy) params.set('sortBy', query.sortBy);
  if (query.sortOrder) params.set('sortOrder', query.sortOrder);

  const res = await adminFetch(`/api/admin/courses?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
    signal: options?.signal,
  });
  return handleResponse<AdminCourseListResponse>(res);
}

export async function fetchAdminMaterials(
  query: Partial<AdminMaterialListQuery> = {},
  options?: { signal?: AbortSignal }
): Promise<AdminMaterialListResponse> {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.search) params.set('search', query.search);
  if (query.status) params.set('status', query.status);
  if (query.sortBy) params.set('sortBy', query.sortBy);
  if (query.sortOrder) params.set('sortOrder', query.sortOrder);

  const res = await adminFetch(`/api/admin/materials?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
    signal: options?.signal,
  });
  return handleResponse<AdminMaterialListResponse>(res);
}

export async function fetchAdminAssignments(
  query: Partial<AdminAssignmentListQuery> = {},
  options?: { signal?: AbortSignal }
): Promise<AdminAssignmentListResponse> {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.search) params.set('search', query.search);
  if (query.status) params.set('status', query.status);
  if (query.priority) params.set('priority', query.priority);
  if (query.sortBy) params.set('sortBy', query.sortBy);
  if (query.sortOrder) params.set('sortOrder', query.sortOrder);

  const res = await adminFetch(`/api/admin/assignments?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
    signal: options?.signal,
  });
  return handleResponse<AdminAssignmentListResponse>(res);
}

export async function fetchAdminNotes(
  query: Partial<AdminNoteListQuery> = {},
  options?: { signal?: AbortSignal }
): Promise<AdminNoteListResponse> {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.search) params.set('search', query.search);
  if (query.sortBy) params.set('sortBy', query.sortBy);
  if (query.sortOrder) params.set('sortOrder', query.sortOrder);

  const res = await adminFetch(`/api/admin/notes?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
    signal: options?.signal,
  });
  return handleResponse<AdminNoteListResponse>(res);
}

export async function fetchAdminSchedules(
  query: Partial<AdminScheduleListQuery> = {},
  options?: { signal?: AbortSignal }
): Promise<AdminScheduleListResponse> {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.search) params.set('search', query.search);
  if (query.dayOfWeek) params.set('dayOfWeek', String(query.dayOfWeek));
  if (query.sortBy) params.set('sortBy', query.sortBy);
  if (query.sortOrder) params.set('sortOrder', query.sortOrder);

  const res = await adminFetch(`/api/admin/schedules?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
    signal: options?.signal,
  });
  return handleResponse<AdminScheduleListResponse>(res);
}

export async function fetchAdminQuizzes(
  query: Partial<AdminQuizListQuery> = {},
  options?: { signal?: AbortSignal }
): Promise<AdminQuizListResponse> {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.search) params.set('search', query.search);
  if (query.status) params.set('status', query.status);
  if (query.sortBy) params.set('sortBy', query.sortBy);
  if (query.sortOrder) params.set('sortOrder', query.sortOrder);

  const res = await adminFetch(`/api/admin/quizzes?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
    signal: options?.signal,
  });
  return handleResponse<AdminQuizListResponse>(res);
}




