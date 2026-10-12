import {
  DashboardSummary,
  DashboardChartsResponse,
  DashboardChartPeriod,
} from '@studyflow/shared';
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

export interface GetDashboardChartsParams {
  period?: DashboardChartPeriod;
  semesterId?: string;
}

export async function getDashboardCharts(
  params: GetDashboardChartsParams = {}
): Promise<DashboardChartsResponse> {
  const searchParams = new URLSearchParams();
  if (params.period) searchParams.set('period', params.period);
  if (params.semesterId) searchParams.set('semesterId', params.semesterId);

  const query = searchParams.toString();
  const url = `/api/dashboard/charts${query ? `?${query}` : ''}`;

  const res = await authFetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(errorData.error?.message || 'Gagal memuat data grafik dashboard');
    (err as any).code = errorData.error?.code;
    throw err;
  }
  return res.json();
}

