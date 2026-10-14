import {
  SetPinResponse,
  PinnedItemsListResponse,
} from '@studyflow/shared';
import { authFetch } from './auth-client';

export async function pinMaterial(materialId: string, pinned: boolean): Promise<SetPinResponse> {
  const res = await authFetch(`/api/materials/${materialId}/pin`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pinned }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(
      errorData.error?.message ||
        (pinned ? 'Gagal menyematkan materi' : 'Gagal melepas sematan materi')
    );
    (err as any).code = errorData.error?.code;
    throw err;
  }

  return res.json();
}

export async function pinNote(noteId: string, pinned: boolean): Promise<SetPinResponse> {
  const res = await authFetch(`/api/notes/${noteId}/pin`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pinned }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(
      errorData.error?.message ||
        (pinned ? 'Gagal menyematkan catatan' : 'Gagal melepas sematan catatan')
    );
    (err as any).code = errorData.error?.code;
    throw err;
  }

  return res.json();
}

export async function listPinnedItems(semesterId?: string): Promise<PinnedItemsListResponse> {
  const query = semesterId ? `?semesterId=${encodeURIComponent(semesterId)}` : '';
  const res = await authFetch(`/api/dashboard/pinned${query}`);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(
      errorData.error?.message || 'Gagal memuat item yang disematkan'
    );
    (err as any).code = errorData.error?.code;
    throw err;
  }

  return res.json();
}
