import {
  Course,
  CreateCourseInput,
  UpdateCourseInput,
} from '@studyflow/shared';
import { authFetch } from './auth-client';

export async function listCourses(params?: {
  semesterId?: string;
  isArchived?: boolean;
  search?: string;
}): Promise<{ courses: Course[] }> {
  const searchParams = new URLSearchParams();
  if (params?.semesterId) searchParams.set('semesterId', params.semesterId);
  if (params?.isArchived !== undefined) searchParams.set('isArchived', String(params.isArchived));
  if (params?.search) searchParams.set('search', params.search);

  const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const res = await authFetch(`/api/courses${query}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Gagal memuat daftar mata kuliah');
  }
  return res.json();
}

export async function getCourse(id: string): Promise<Course> {
  const res = await authFetch(`/api/courses/${id}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Gagal memuat data mata kuliah');
  }
  const data = await res.json();
  return data.course;
}

export async function createCourse(input: CreateCourseInput): Promise<Course> {
  const res = await authFetch('/api/courses', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Gagal menambahkan mata kuliah baru');
  }
  const data = await res.json();
  return data.course;
}

export async function updateCourse(id: string, input: UpdateCourseInput): Promise<Course> {
  const res = await authFetch(`/api/courses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Gagal memperbarui mata kuliah');
  }
  const data = await res.json();
  return data.course;
}

export async function archiveCourse(id: string): Promise<Course> {
  const res = await authFetch(`/api/courses/${id}/archive`, {
    method: 'POST',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Gagal mengarsipkan mata kuliah');
  }
  const data = await res.json();
  return data.course;
}

export async function unarchiveCourse(id: string): Promise<Course> {
  const res = await authFetch(`/api/courses/${id}/unarchive`, {
    method: 'POST',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Gagal memulihkan mata kuliah');
  }
  const data = await res.json();
  return data.course;
}

export async function deleteCourse(id: string): Promise<void> {
  const res = await authFetch(`/api/courses/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Gagal menghapus mata kuliah');
  }
}
