import {
  MaterialSummary,
  AiQuotaStatus,
  SummaryResponse,
  GenerateSummaryResponse,
} from '@studyflow/shared';
import { authFetch } from './auth-client';

export class SummaryApiError extends Error {
  code?: string;
  statusCode?: number;

  constructor(message: string, code?: string, statusCode?: number) {
    super(message);
    this.name = 'SummaryApiError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Fetch summary and AI quota for a material.
 */
export async function getMaterialSummary(materialId: string): Promise<SummaryResponse> {
  const res = await authFetch(`/api/materials/${materialId}/summary`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new SummaryApiError(
      errorData.error?.message || 'Gagal memuat ringkasan materi',
      errorData.error?.code,
      res.status
    );
  }
  return res.json();
}

/**
 * Request generation or regeneration of an AI summary.
 */
export async function generateMaterialSummary(
  materialId: string,
  regenerate = false
): Promise<GenerateSummaryResponse> {
  const res = await authFetch(`/api/materials/${materialId}/summary`, {
    method: 'POST',
    body: JSON.stringify({ regenerate }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new SummaryApiError(
      errorData.error?.message || 'Gagal meminta pembuatan ringkasan AI',
      errorData.error?.code,
      res.status
    );
  }
  return res.json();
}

/**
 * Fetch general AI quota status for user.
 */
export async function getAiQuotaStatus(): Promise<{ quota: AiQuotaStatus }> {
  const res = await authFetch('/api/materials/usage/ai');
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new SummaryApiError(
      errorData.error?.message || 'Gagal memuat status kuota AI',
      errorData.error?.code,
      res.status
    );
  }
  return res.json();
}
