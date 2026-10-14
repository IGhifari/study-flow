import {
  SearchQuery,
  SearchResponse,
} from '@studyflow/shared';
import { authFetch } from './auth-client';

export async function searchGlobalClient(
  query: SearchQuery,
  signal?: AbortSignal
): Promise<SearchResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('q', query.q);
  if (query.semesterId) {
    searchParams.set('semesterId', query.semesterId);
  }
  if (query.limit) {
    searchParams.set('limit', String(query.limit));
  }

  const res = await authFetch(`/api/search?${searchParams.toString()}`, {
    signal,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Gagal melakukan pencarian');
  }

  return res.json();
}
