import { describe, it, expect } from 'vitest';
import { DashboardChartsQuerySchema } from '@studyflow/shared';

describe('DashboardChartsQuerySchema', () => {
  it('defaults period to 30d when omitted', () => {
    const parsed = DashboardChartsQuerySchema.parse({});
    expect(parsed.period).toBe('30d');
  });

  it('accepts explicit periods 7d, 30d, and 3m and rejects invalid values', () => {
    expect(DashboardChartsQuerySchema.parse({ period: '7d' }).period).toBe('7d');
    expect(DashboardChartsQuerySchema.parse({ period: '30d' }).period).toBe('30d');
    expect(DashboardChartsQuerySchema.parse({ period: '3m' }).period).toBe('3m');
    expect(DashboardChartsQuerySchema.safeParse({ period: '1y' }).success).toBe(false);
  });
});
