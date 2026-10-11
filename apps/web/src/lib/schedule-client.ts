import {
  CourseSchedule,
  CourseScheduleResponse,
  CourseScheduleListResponse,
  CreateCourseScheduleInput,
  UpdateCourseScheduleInput,
} from '@studyflow/shared';
import { authFetch } from './auth-client';

export async function listSchedules(params?: {
  semesterId?: string;
  courseId?: string;
  dayOfWeek?: number;
}): Promise<CourseScheduleListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.semesterId) searchParams.set('semesterId', params.semesterId);
  if (params?.courseId) searchParams.set('courseId', params.courseId);
  if (params?.dayOfWeek !== undefined) searchParams.set('dayOfWeek', String(params.dayOfWeek));

  const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const res = await authFetch(`/api/schedules${query}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Gagal memuat daftar jadwal kuliah');
  }
  return res.json();
}

export async function getSchedule(id: string): Promise<CourseScheduleResponse> {
  const res = await authFetch(`/api/schedules/${id}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Gagal memuat detail jadwal kuliah');
  }
  return res.json();
}

export async function createSchedule(
  input: CreateCourseScheduleInput
): Promise<CourseScheduleResponse> {
  const res = await authFetch('/api/schedules', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Gagal menambahkan jadwal kuliah');
  }
  return res.json();
}

export async function updateSchedule(
  id: string,
  input: UpdateCourseScheduleInput
): Promise<CourseScheduleResponse> {
  const res = await authFetch(`/api/schedules/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Gagal memperbarui jadwal kuliah');
  }
  return res.json();
}

export async function deleteSchedule(
  id: string
): Promise<{ success: boolean; message: string }> {
  const res = await authFetch(`/api/schedules/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Gagal menghapus jadwal kuliah');
  }
  return res.json();
}
