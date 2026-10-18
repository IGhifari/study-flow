'use client';

import * as React from 'react';
import { TrendingUp, RefreshCw, AlertCircle, FileText, CheckSquare } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { fetchAdminTrends } from '@/lib/admin-api';
import type { AdminTrendRange, AdminTrendsResponse, AdminTrendDataPoint } from '@studyflow/shared';

const RANGES: Array<{ value: AdminTrendRange; label: string }> = [
  { value: '7d', label: '7 Hari' },
  { value: '30d', label: '30 Hari' },
  { value: '90d', label: '90 Hari' },
];

export function ActivityTrendsCard() {
  const [range, setRange] = React.useState<AdminTrendRange>('30d');
  const [trends, setTrends] = React.useState<AdminTrendsResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = React.useState<AdminTrendDataPoint | null>(null);

  const loadTrends = React.useCallback(async (selectedRange: AdminTrendRange, signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchAdminTrends(selectedRange, { signal });
      setTrends(res);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Gagal memuat tren aktivitas platform');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    loadTrends(range, controller.signal);
    return () => controller.abort();
  }, [range, loadTrends]);

  const maxVal = React.useMemo(() => {
    if (!trends || trends.data.length === 0) return 10;
    const max = Math.max(
      ...trends.data.map((d) => Math.max(d.materi, d.tugas)),
      1
    );
    return Math.ceil(max * 1.15); // Add headroom
  }, [trends]);

  return (
    <Card className="border-border bg-card shadow-xs flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <CardTitle className="text-base font-semibold">
                Tren Aktivitas Mahasiswa
              </CardTitle>
            </div>
            <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border">
              {RANGES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRange(r.value)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    range === r.value
                      ? 'bg-background text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <CardDescription className="text-xs">
            Volume penambahan materi berkas PDF dan pembuatan tugas baru.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="text-xs">Gagal Mengambil Data Tren</AlertTitle>
              <AlertDescription className="text-xs flex items-center justify-between">
                <span>{error}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadTrends(range)}
                  className="h-7 text-xs"
                >
                  Coba Lagi
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Metric Summary in selected range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-muted/20 p-2.5 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Materi Baru ({range})</p>
                <p className="text-lg font-bold text-foreground tabular-nums">
                  {isLoading ? (
                    <Skeleton className="h-5 w-12" />
                  ) : (
                    trends?.totals.materi.toLocaleString('id-ID') ?? '0'
                  )}
                </p>
              </div>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs gap-1">
                <FileText className="h-3 w-3" />
                <span>PDF</span>
              </Badge>
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-2.5 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Tugas Baru ({range})</p>
                <p className="text-lg font-bold text-foreground tabular-nums">
                  {isLoading ? (
                    <Skeleton className="h-5 w-12" />
                  ) : (
                    trends?.totals.tugas.toLocaleString('id-ID') ?? '0'
                  )}
                </p>
              </div>
              <Badge variant="outline" className="bg-warning text-warning-foreground border-transparent text-xs gap-1">
                <CheckSquare className="h-3 w-3" />
                <span>Tugas</span>
              </Badge>
            </div>
          </div>

          {/* Chart Area */}
          <div className="relative pt-2">
            {isLoading && !trends ? (
              <div className="h-44 w-full flex items-end gap-1.5 pb-4">
                {Array.from({ length: 14 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    className="flex-1 rounded-t-sm"
                    style={{ height: `${20 + (i % 5) * 15}%` }}
                  />
                ))}
              </div>
            ) : !trends || trends.data.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-xs text-muted-foreground">
                Tidak ada data tren pada rentang waktu ini.
              </div>
            ) : (
              <div className="space-y-2">
                {/* SVG Visual Bars */}
                <div
                  className="h-40 w-full flex items-end gap-1 px-1 relative select-none"
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  {trends.data.map((point) => {
                    const materiHeightPct = Math.round((point.materi / maxVal) * 100);
                    const tugasHeightPct = Math.round((point.tugas / maxVal) * 100);
                    const isHovered = hoveredPoint?.date === point.date;

                    return (
                      <div
                        key={point.date}
                        className="flex-1 h-full flex items-end justify-center gap-0.5 group relative cursor-pointer"
                        onMouseEnter={() => setHoveredPoint(point)}
                      >
                        {/* Bar Materi */}
                        <div
                          className={`w-1/2 rounded-t-xs transition-all ${
                            isHovered
                              ? 'bg-primary'
                              : 'bg-primary/75 group-hover:bg-primary'
                          }`}
                          style={{
                            height: `${Math.max(point.materi > 0 ? 6 : 2, materiHeightPct)}%`,
                          }}
                        />
                        {/* Bar Tugas */}
                        <div
                          className={`w-1/2 rounded-t-xs transition-all ${
                            isHovered
                              ? 'bg-amber-500'
                              : 'bg-amber-500/75 group-hover:bg-amber-500'
                          }`}
                          style={{
                            height: `${Math.max(point.tugas > 0 ? 6 : 2, tugasHeightPct)}%`,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Hover Tooltip / Detail Bar */}
                <div className="h-6 flex items-center justify-between text-xs px-1 border-t border-border pt-1">
                  {hoveredPoint ? (
                    <>
                      <span className="font-mono text-muted-foreground">
                        {hoveredPoint.date}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-primary font-medium">
                          Materi: <strong className="tabular-nums">{hoveredPoint.materi}</strong>
                        </span>
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          Tugas: <strong className="tabular-nums">{hoveredPoint.tugas}</strong>
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-muted-foreground">
                        {trends.startDate.slice(0, 10)} s/d {trends.endDate.slice(0, 10)}
                      </span>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-primary inline-block" /> Materi
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" /> Tugas
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
