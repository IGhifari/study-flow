import {
  CalendarQuery,
  CalendarResponse,
} from '@studyflow/shared';
import { authFetch } from './auth-client';

export async function getCalendarData(
  query: CalendarQuery,
  signal?: AbortSignal
): Promise<CalendarResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('startDate', query.startDate);
  searchParams.set('endDate', query.endDate);
  if (query.semesterId) searchParams.set('semesterId', query.semesterId);
  if (query.courseId) searchParams.set('courseId', query.courseId);
  if (query.type) searchParams.set('type', query.type);

  const res = await authFetch(`/api/calendar?${searchParams.toString()}`, {
    signal,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Gagal memuat data kalender akademik');
  }

  return res.json();
}
