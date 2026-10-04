import {
  Assignment,
  CreateAssignmentInput,
  UpdateAssignmentInput,
  AssignmentListQuery,
} from '@studyflow/shared';
import { authFetch } from './auth-client';

export interface AssignmentListResponse {
  assignments: Assignment[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export async function listAssignments(params?: AssignmentListQuery): Promise<AssignmentListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.semesterId) searchParams.set('semesterId', params.semesterId);
  if (params?.courseId) searchParams.set('courseId', params.courseId);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.priority) searchParams.set('priority', params.priority);
  if (params?.isOverdue !== undefined) searchParams.set('isOverdue', String(params.isOverdue));
  if (params?.search) searchParams.set('search', params.search);
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder);

  const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const res = await authFetch(`/api/assignments${query}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Gagal memuat daftar tugas');
  }
  return res.json();
}

export async function getAssignment(id: string): Promise<Assignment> {
  const res = await authFetch(`/api/assignments/${id}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Gagal memuat detail tugas');
  }
  const data = await res.json();
  return data.assignment;
}

export async function createAssignment(input: CreateAssignmentInput): Promise<Assignment> {
  const res = await authFetch('/api/assignments', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(errorData.error?.message || 'Gagal menambahkan tugas baru');
    (err as any).code = errorData.error?.code;
    throw err;
  }
  const data = await res.json();
  return data.assignment;
}

export async function updateAssignment(id: string, input: UpdateAssignmentInput): Promise<Assignment> {
  const res = await authFetch(`/api/assignments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(errorData.error?.message || 'Gagal memperbarui tugas');
    (err as any).code = errorData.error?.code;
    throw err;
  }
  const data = await res.json();
  return data.assignment;
}

export async function deleteAssignment(id: string): Promise<void> {
  const res = await authFetch(`/api/assignments/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(errorData.error?.message || 'Gagal menghapus tugas');
    (err as any).code = errorData.error?.code;
    throw err;
  }
}
