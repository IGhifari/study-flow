import {
  Semester,
  CreateSemesterInput,
  UpdateSemesterInput,
} from '@studyflow/shared';
import { authFetch } from './auth-client';

export async function listSemesters(status?: 'all' | 'active' | 'archived'): Promise<{ semesters: Semester[]; activeSemester: Semester | null }> {
  const query = status ? `?status=${status}` : '';
  const res = await authFetch(`/api/semesters${query}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Gagal memuat daftar semester');
  }
  return res.json();
}

export async function getSemester(id: string): Promise<Semester> {
  const res = await authFetch(`/api/semesters/${id}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Gagal memuat data semester');
  }
  const data = await res.json();
  return data.semester;
}

export async function createSemester(input: CreateSemesterInput): Promise<Semester> {
  const res = await authFetch('/api/semesters', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Gagal membuat semester baru');
  }
  const data = await res.json();
  return data.semester;
}

export async function updateSemester(id: string, input: UpdateSemesterInput): Promise<Semester> {
  const res = await authFetch(`/api/semesters/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Gagal memperbarui semester');
  }
  const data = await res.json();
  return data.semester;
}

export async function activateSemester(id: string): Promise<Semester> {
  const res = await authFetch(`/api/semesters/${id}/activate`, {
    method: 'POST',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Gagal mengaktifkan semester');
  }
  const data = await res.json();
  return data.semester;
}

export async function archiveSemester(id: string): Promise<Semester> {
  const res = await authFetch(`/api/semesters/${id}/archive`, {
    method: 'POST',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Gagal mengarsipkan semester');
  }
  const data = await res.json();
  return data.semester;
}

export async function unarchiveSemester(id: string): Promise<Semester> {
  const res = await authFetch(`/api/semesters/${id}/unarchive`, {
    method: 'POST',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Gagal memulihkan semester');
  }
  const data = await res.json();
  return data.semester;
}

export async function deleteSemester(id: string): Promise<void> {
  const res = await authFetch(`/api/semesters/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Gagal menghapus semester');
  }
}
