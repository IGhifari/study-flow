import {
  Note,
  NoteListItem,
  CreateNoteInput,
  UpdateNoteInput,
  NoteListQuery,
} from '@studyflow/shared';
import { authFetch } from './auth-client';

export interface NoteListResponse {
  notes: NoteListItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export async function listNotes(params?: NoteListQuery): Promise<NoteListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.semesterId) searchParams.set('semesterId', params.semesterId);
  if (params?.courseId) searchParams.set('courseId', params.courseId);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));

  const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const res = await authFetch(`/api/notes${query}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Gagal memuat daftar catatan');
  }
  return res.json();
}

export async function getNote(id: string): Promise<Note> {
  const res = await authFetch(`/api/notes/${id}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(errorData.error?.message || 'Gagal memuat catatan');
    (err as any).code = errorData.error?.code;
    throw err;
  }
  const data = await res.json();
  return data.note;
}

export async function createNote(input: CreateNoteInput): Promise<Note> {
  const res = await authFetch('/api/notes', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(errorData.error?.message || 'Gagal membuat catatan baru');
    (err as any).code = errorData.error?.code;
    throw err;
  }
  const data = await res.json();
  return data.note;
}

export async function updateNote(id: string, input: UpdateNoteInput): Promise<Note> {
  const res = await authFetch(`/api/notes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(errorData.error?.message || 'Gagal memperbarui catatan');
    (err as any).code = errorData.error?.code;
    (err as any).currentVersion = errorData.error?.currentVersion;
    throw err;
  }
  const data = await res.json();
  return data.note;
}

export async function deleteNote(id: string): Promise<void> {
  const res = await authFetch(`/api/notes/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(errorData.error?.message || 'Gagal menghapus catatan');
    (err as any).code = errorData.error?.code;
    throw err;
  }
}
