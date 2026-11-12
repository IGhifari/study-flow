import {
  AdminLoginInput,
  AdminSummary,
  AdminUserListQuery,
  AdminUserListResponse,
  AdminUserDetail,
  AdminCreateUserInput,
  AdminUpdateUserInput,
  AdminUpdateMaterialInput,
  AdminCleanupJobsInput,
  AdminUpdateProfileInput,
  AdminChangePasswordInput,
  AdminSessionsResponse,
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
import { refreshAccessToken } from '@/lib/auth-client';

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

interface AdminErrorPayload {
  message?: string;
  code?: string;
  error?: {
    message?: string;
    code?: string;
    details?: Record<string, string[]>;
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorJson: AdminErrorPayload | null = null;
    try {
      errorJson = (await res.json()) as AdminErrorPayload;
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

  // If unauthorized and not calling auth endpoints, share the unified refresh queue
  if (
    response.status === 401 &&
    !url.includes('/api/admin/auth/refresh') &&
    !url.includes('/api/admin/auth/login') &&
    !url.includes('/api/admin/auth/logout')
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
  if (query.role) params.set('role', query.role);
  if (query.verified) params.set('verified', query.verified);
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

// ==========================================
// User Full CRUD Operations
// ==========================================

export async function createAdminUserApi(
  input: AdminCreateUserInput
): Promise<{ message: string; user: { id: string; name: string; email: string; role: string } }> {
  const res = await adminFetch('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return handleResponse<{ message: string; user: { id: string; name: string; email: string; role: string } }>(res);
}

export async function updateAdminUserApi(
  userId: string,
  input: AdminUpdateUserInput
): Promise<{ message: string; user: AdminUserDetail }> {
  const res = await adminFetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return handleResponse<{ message: string; user: AdminUserDetail }>(res);
}

export async function deleteAdminUserApi(userId: string): Promise<{ message: string }> {
  const res = await adminFetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
  return handleResponse<{ message: string }>(res);
}

// ==========================================
// Material Full CRUD & Moderation Operations
// ==========================================

export async function updateAdminMaterialApi(
  materialId: string,
  input: AdminUpdateMaterialInput
): Promise<{ message: string; materialId: string }> {
  const res = await adminFetch(`/api/admin/materials/${encodeURIComponent(materialId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return handleResponse<{ message: string; materialId: string }>(res);
}

export async function deleteAdminMaterialApi(materialId: string): Promise<{ message: string }> {
  const res = await adminFetch(`/api/admin/materials/${encodeURIComponent(materialId)}`, {
    method: 'DELETE',
  });
  return handleResponse<{ message: string }>(res);
}

// ==========================================
// Job Management & Cleanup Operations
// ==========================================

export async function retryAdminJobApi(jobId: string): Promise<{ message: string; jobId: string }> {
  const res = await adminFetch(`/api/admin/jobs/${encodeURIComponent(jobId)}/retry`, {
    method: 'POST',
  });
  return handleResponse<{ message: string; jobId: string }>(res);
}

export async function deleteAdminJobApi(jobId: string): Promise<{ message: string }> {
  const res = await adminFetch(`/api/admin/jobs/${encodeURIComponent(jobId)}`, {
    method: 'DELETE',
  });
  return handleResponse<{ message: string }>(res);
}

export async function cleanupAdminJobsApi(
  input: AdminCleanupJobsInput
): Promise<{ message: string; deletedCount: number }> {
  const res = await adminFetch('/api/admin/jobs/cleanup', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return handleResponse<{ message: string; deletedCount: number }>(res);
}

// ==========================================
// Administrator Profile & Security Operations
// ==========================================

export async function updateAdminProfileApi(
  input: AdminUpdateProfileInput
): Promise<{ message: string; user: UserProfile }> {
  const res = await adminFetch('/api/admin/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return handleResponse<{ message: string; user: UserProfile }>(res);
}

export async function changeAdminPasswordApi(
  input: AdminChangePasswordInput
): Promise<{ message: string }> {
  const res = await adminFetch('/api/admin/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return handleResponse<{ message: string }>(res);
}

export async function fetchAdminSessionsApi(
  options?: { signal?: AbortSignal }
): Promise<AdminSessionsResponse> {
  const res = await adminFetch('/api/admin/auth/sessions', {
    method: 'GET',
    cache: 'no-store',
    signal: options?.signal,
  });
  return handleResponse<AdminSessionsResponse>(res);
}

export async function revokeAdminSessionApi(sessionId: string): Promise<{ message: string }> {
  const res = await adminFetch(`/api/admin/auth/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  });
  return handleResponse<{ message: string }>(res);
}





