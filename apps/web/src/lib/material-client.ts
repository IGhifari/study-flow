import {
  Material,
  MaterialListItem,
  MaterialListQuery,
  MaterialListResponse,
  InitiateUploadInput,
  InitiateUploadResponse,
  FinalizeUploadResponse,
  UpdateMaterialInput,
  MaterialDownloadResponse,
  StorageUsageResponse,
  ProcessingJob,
} from '@studyflow/shared';
import { authFetch } from './auth-client';

export async function listMaterials(params?: MaterialListQuery): Promise<MaterialListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.semesterId) searchParams.set('semesterId', params.semesterId);
  if (params?.courseId) searchParams.set('courseId', params.courseId);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));

  const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const res = await authFetch(`/api/materials${query}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Gagal memuat daftar materi');
  }
  return res.json();
}

export async function getMaterial(id: string): Promise<Material> {
  const res = await authFetch(`/api/materials/${id}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(errorData.error?.message || 'Gagal memuat materi');
    (err as any).code = errorData.error?.code;
    throw err;
  }
  const data = await res.json();
  return data.material;
}

export async function initiateUpload(input: InitiateUploadInput): Promise<InitiateUploadResponse> {
  const res = await authFetch('/api/materials/initiate-upload', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(errorData.error?.message || 'Gagal memulai upload file');
    (err as any).code = errorData.error?.code;
    throw err;
  }
  return res.json();
}

export async function finalizeUpload(materialId: string): Promise<FinalizeUploadResponse> {
  const res = await authFetch('/api/materials/finalize-upload', {
    method: 'POST',
    body: JSON.stringify({ materialId }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(errorData.error?.message || 'Gagal memverifikasi upload materi');
    (err as any).code = errorData.error?.code;
    throw err;
  }
  return res.json();
}

export async function updateMaterial(
  id: string,
  input: UpdateMaterialInput
): Promise<MaterialListItem> {
  const res = await authFetch(`/api/materials/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(errorData.error?.message || 'Gagal memperbarui judul materi');
    (err as any).code = errorData.error?.code;
    throw err;
  }
  const data = await res.json();
  return data.material;
}

export async function retryMaterialProcessing(
  id: string
): Promise<{ message: string; jobId: string }> {
  const res = await authFetch(`/api/materials/${id}/retry`, {
    method: 'POST',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(errorData.error?.message || 'Gagal mengulang pemrosesan materi');
    (err as any).code = errorData.error?.code;
    throw err;
  }
  return res.json();
}

export async function deleteMaterial(id: string): Promise<void> {
  const res = await authFetch(`/api/materials/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(errorData.error?.message || 'Gagal menghapus materi');
    (err as any).code = errorData.error?.code;
    throw err;
  }
}

export async function getMaterialDownloadUrl(id: string): Promise<MaterialDownloadResponse> {
  const res = await authFetch(`/api/materials/${id}/download`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(errorData.error?.message || 'Gagal membuat tautan unduhan');
    (err as any).code = errorData.error?.code;
    throw err;
  }
  return res.json();
}

export async function getProcessingJob(jobId: string): Promise<{ job: ProcessingJob }> {
  const res = await authFetch(`/api/materials/jobs/${jobId}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(errorData.error?.message || 'Gagal memuat status pemrosesan');
    (err as any).code = errorData.error?.code;
    throw err;
  }
  return res.json();
}

export async function getStorageUsage(): Promise<StorageUsageResponse> {
  const res = await authFetch('/api/materials/usage');
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(errorData.error?.message || 'Gagal memuat kuota penyimpanan');
    (err as any).code = errorData.error?.code;
    throw err;
  }
  return res.json();
}
