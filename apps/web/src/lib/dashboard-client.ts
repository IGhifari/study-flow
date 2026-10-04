import { DashboardSummary } from '@studyflow/shared';
import { authFetch } from './auth-client';

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const res = await authFetch('/api/dashboard');
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(errorData.error?.message || 'Gagal memuat ringkasan dashboard');
    (err as any).code = errorData.error?.code;
    throw err;
  }
  return res.json();
}
