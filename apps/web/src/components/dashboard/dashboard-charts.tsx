'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  DashboardChartsResponse,
  DashboardChartPeriod,
  ActivityBucket,
} from '@studyflow/shared';
import { getDashboardCharts } from '@/lib/dashboard-client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  RadixSelect as Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

const activityChartConfig = {
  tasksCompleted: {
    label: 'Tugas selesai',
    color: 'var(--chart-1)',
  },
  quizzesCompleted: {
    label: 'Kuis selesai',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig;

const workloadChartConfig = {
  pendingTasks: {
    label: 'Tugas belum selesai',
    color: 'var(--chart-4)',
  },
} satisfies ChartConfig;

interface DashboardChartsProps {
  activeSemesterId?: string | null;
  refreshTrigger?: number;
}

export function DashboardCharts({
  activeSemesterId,
  refreshTrigger = 0,
}: DashboardChartsProps): React.JSX.Element {
  const router = useRouter();
  const [period, setPeriod] = React.useState<DashboardChartPeriod>('30d');
  const [chartsData, setChartsData] = React.useState<DashboardChartsResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [showAccessibleTable, setShowAccessibleTable] = React.useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const fetchIdRef = React.useRef(0);

  const loadCharts = React.useCallback(
    async (silent = false) => {
      const currentRequestId = ++fetchIdRef.current;
      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMsg(null);

      try {
        const data = await getDashboardCharts({
          period,
          semesterId: activeSemesterId || undefined,
        });
        if (currentRequestId === fetchIdRef.current) {
          setChartsData(data);
        }
      } catch (err: any) {
        if (currentRequestId === fetchIdRef.current) {
          setErrorMsg(err.message || 'Gagal memuat data grafik dashboard.');
        }
      } finally {
        if (currentRequestId === fetchIdRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [period, activeSemesterId]
  );

  React.useEffect(() => {
    loadCharts(false);
  }, [loadCharts, refreshTrigger]);

  // Semester change listener
  React.useEffect(() => {
    const handleSemesterChange = () => {
      loadCharts(true);
    };
    window.addEventListener('studyflow:semester-changed', handleSemesterChange);
    return () => {
      window.removeEventListener('studyflow:semester-changed', handleSemesterChange);
    };
  }, [loadCharts]);

  const handleBarClick = (courseId: string) => {
    if (courseId) {
      router.push(`/assignments?courseId=${encodeURIComponent(courseId)}`);
    }
  };

  // 1. Error state (terisolasi, tidak memblokir widget dashboard lain)
  if (errorMsg) {
    return (
      <Card className="rounded-xl border border-destructive/20 bg-card p-6 shadow-xs">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Gagal memuat grafik aktivitas</AlertTitle>
          <AlertDescription className="flex items-center justify-between mt-1">
            <span className="text-sm">{errorMsg}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadCharts(false)}
              className="h-8 gap-1.5 text-xs shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Coba lagi</span>
            </Button>
          </AlertDescription>
        </Alert>
      </Card>
    );
  }

  // 2. Loading Skeleton
  if (isLoading && !chartsData) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:gap-6 w-full">
        <Card className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div className="space-y-1">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3.5 w-56" />
            </div>
            <Skeleton className="h-9 w-32 rounded-lg" />
          </div>
          <div className="pt-6">
            <Skeleton className="h-[250px] w-full rounded-lg" />
          </div>
        </Card>
        <Card className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div className="space-y-1">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3.5 w-48" />
            </div>
          </div>
          <div className="pt-6">
            <Skeleton className="h-[250px] w-full rounded-lg" />
          </div>
        </Card>
      </div>
    );
  }

  const activity = chartsData?.activityChart;
  const workload = chartsData?.workloadChart;

  const totalActivities =
    (activity?.totalTasksCompleted || 0) + (activity?.totalQuizzesCompleted || 0);

  // Hitung tinggi chart beban tugas dinamis agar tidak memotong mata kuliah
  const courseCount = workload?.items.length || 0;
  const workloadChartHeight = Math.max(220, Math.min(courseCount * 44 + 40, 480));

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Tombol aksesibilitas untuk melihat tabel angka */}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setShowAccessibleTable((prev) => !prev)}
          className="text-xs text-muted-foreground hover:text-foreground underline transition-colors cursor-pointer"
          aria-expanded={showAccessibleTable}
        >
          {showAccessibleTable ? 'Sembunyikan tabel ringkasan angka' : 'Tampilkan tabel ringkasan angka'}
        </button>
      </div>

      {showAccessibleTable && chartsData && (
        <Card className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <h3 className="text-sm font-semibold text-foreground mb-2">
            Tabel Ringkasan Aktivitas Belajar ({chartsData.semesterName || 'Semester Aktif'})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Periode</th>
                  <th className="py-2 px-4 font-medium text-right">Tugas Selesai</th>
                  <th className="py-2 px-4 font-medium text-right">Kuis Selesai</th>
                  <th className="py-2 pl-4 font-medium text-right">Total Aktivitas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {activity?.items.map((item: ActivityBucket) => (
                  <tr key={item.date} className="hover:bg-muted/30">
                    <td className="py-2 pr-4 text-foreground font-medium">{item.fullDateLabel}</td>
                    <td className="py-2 px-4 text-right tabular-nums">{item.tasksCompleted}</td>
                    <td className="py-2 px-4 text-right tabular-nums">{item.quizzesCompleted}</td>
                    <td className="py-2 pl-4 text-right font-semibold tabular-nums">
                      {item.tasksCompleted + item.quizzesCompleted}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:gap-6 w-full">
        {/* =========================================================================
            CHART 1: AKTIVITAS BELAJAR (INTERACTIVE AREA CHART)
           ========================================================================= */}
        <Card className="rounded-xl border border-border bg-card shadow-xs flex flex-col justify-between">
          <div>
            <CardHeader className="flex flex-col gap-2 space-y-0 border-b border-border py-4 sm:flex-row sm:items-center sm:justify-between sm:py-4.5">
              <div className="grid flex-1 gap-1">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base sm:text-lg font-semibold text-foreground">
                    Aktivitas Belajar
                  </CardTitle>
                  {isRefreshing && <Loader2 className="h-3 w-3 animate-spin text-primary ml-1" />}
                </div>
                <CardDescription className="text-xs text-muted-foreground">
                  {period === '7d'
                    ? '7 hari terakhir'
                    : period === '30d'
                    ? '30 hari terakhir'
                    : '3 bulan terakhir (mingguan)'}
                  {' • '}
                  <span className="font-medium text-foreground">
                    {totalActivities} aktivitas selesai
                  </span>
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Select
                  value={period}
                  onValueChange={(val) => setPeriod(val as DashboardChartPeriod)}
                >
                  <SelectTrigger
                    className="w-[140px] sm:w-[150px] h-9 text-xs rounded-lg"
                    aria-label="Pilih periode aktivitas belajar"
                  >
                    <SelectValue placeholder="30 hari terakhir" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="7d" className="rounded-lg text-xs">
                      7 hari terakhir
                    </SelectItem>
                    <SelectItem value="30d" className="rounded-lg text-xs">
                      30 hari terakhir
                    </SelectItem>
                    <SelectItem value="3m" className="rounded-lg text-xs">
                      3 bulan terakhir
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent className="px-2 pt-4 sm:px-5 sm:pt-5">
              {!activity || activity.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <Activity className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm font-medium text-foreground">
                    Belum ada riwayat aktivitas belajar
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">
                    Selesaikan tugas kuliah atau kerjakan kuis materi untuk mencatat kemajuan belajar.
                  </p>
                </div>
              ) : (
                <ChartContainer
                  config={activityChartConfig}
                  className="aspect-auto h-[240px] sm:h-[280px] w-full"
                >
                  <AreaChart data={activity.items} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="fillTasksCompleted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="fillQuizzesCompleted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={24}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={4}
                      domain={[0, 'auto']}
                    />
                    <ChartTooltip
                      cursor={{ stroke: 'var(--border)', strokeWidth: 1, strokeDasharray: '3 3' }}
                      content={
                        <ChartTooltipContent
                          labelFormatter={(_, payload) => {
                            const item = payload?.[0]?.payload;
                            return item?.fullDateLabel || '';
                          }}
                          indicator="dot"
                        />
                      }
                    />
                    <Area
                      dataKey="tasksCompleted"
                      name="Tugas selesai"
                      type="monotone"
                      fill="url(#fillTasksCompleted)"
                      fillOpacity={0.8}
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      isAnimationActive={!prefersReducedMotion}
                    />
                    <Area
                      dataKey="quizzesCompleted"
                      name="Kuis selesai"
                      type="monotone"
                      fill="url(#fillQuizzesCompleted)"
                      fillOpacity={0.8}
                      stroke="var(--chart-2)"
                      strokeWidth={2}
                      isAnimationActive={!prefersReducedMotion}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                  </AreaChart>
                </ChartContainer>
              )}
            </CardContent>
          </div>

          <div className="px-4 py-2.5 sm:px-5 border-t border-border/80 bg-muted/20 rounded-b-xl">
            <p className="text-[11px] leading-relaxed text-muted-foreground flex items-center gap-1.5">
              <HelpCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" />
              <span>
                Satu tugas dihitung maksimal 1x pada penyelesaian pertama. Kuis dihitung per attempt yang disubmit final.
              </span>
            </p>
          </div>
        </Card>

        {/* =========================================================================
            CHART 2: BEBAN TUGAS PER MATA KULIAH (HORIZONTAL BAR CHART)
           ========================================================================= */}
        <Card className="rounded-xl border border-border bg-card shadow-xs flex flex-col justify-between">
          <div>
            <CardHeader className="flex flex-row items-center justify-between pb-3.5 border-b border-border py-4 sm:py-4.5">
              <div className="grid gap-1">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base sm:text-lg font-semibold text-foreground">
                    Beban Tugas
                  </CardTitle>
                </div>
                <CardDescription className="text-xs text-muted-foreground">
                  Jumlah tugas belum selesai per mata kuliah semester ini
                  {' • '}
                  <span className="font-medium text-foreground">
                    {workload?.totalPendingTasks || 0} tugas tersisa
                  </span>
                </CardDescription>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/assignments')}
                className="h-8 px-2 text-xs gap-1 text-primary hover:text-primary"
              >
                <span>Kelola tugas</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </CardHeader>

            <CardContent className="px-2 pt-4 sm:px-5 sm:pt-5">
              {!workload || workload.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <BookOpen className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm font-medium text-foreground">
                    Belum ada mata kuliah aktif di semester ini
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">
                    Tambahkan mata kuliah untuk mulai melacak tugas dan materi perkuliahan.
                  </p>
                </div>
              ) : workload.totalPendingTasks === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/20 text-success-foreground mb-2">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    Semua tugas selesai!
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">
                    Tidak ada tugas pending atau tertunda pada seluruh mata kuliah di semester ini.
                  </p>
                </div>
              ) : (
                <div className="overflow-y-auto max-h-[360px] pr-1">
                  <ChartContainer
                    config={workloadChartConfig}
                    className="w-full"
                    style={{ height: `${workloadChartHeight}px` }}
                  >
                    <BarChart
                      data={workload.items}
                      layout="vertical"
                      margin={{ top: 8, right: 24, left: 10, bottom: 8 }}
                    >
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                        domain={[0, 'auto']}
                      />
                      <YAxis
                        type="category"
                        dataKey="courseName"
                        tickLine={false}
                        axisLine={false}
                        width={160}
                        tick={({ x, y, payload }: any) => {
                          const text = String(payload?.value || '');
                          const truncated =
                            text.length > 24 ? `${text.slice(0, 23)}…` : text;
                          return (
                            <g transform={`translate(${x},${y})`}>
                              <text
                                x={-8}
                                y={3}
                                textAnchor="end"
                                className="text-[11px] fill-foreground font-medium hover:fill-primary cursor-pointer transition-colors"
                              >
                                <title>{text}</title>
                                {truncated}
                              </text>
                            </g>
                          );
                        }}
                      />
                      <ChartTooltip
                        cursor={{ fill: 'var(--muted)', opacity: 0.3 }}
                        content={
                          <ChartTooltipContent
                            formatter={(value, name, item) => (
                              <div className="flex items-center justify-between gap-4 w-full">
                                <span className="text-xs text-muted-foreground">
                                  {item?.payload?.courseName}
                                </span>
                                <span className="font-semibold text-xs tabular-nums text-foreground">
                                  {value} tugas
                                </span>
                              </div>
                            )}
                            indicator="dot"
                          />
                        }
                      />
                      <Bar
                        dataKey="pendingTasks"
                        name="Tugas belum selesai"
                        fill="var(--chart-4)"
                        radius={[0, 4, 4, 0]}
                        maxBarSize={22}
                        className="cursor-pointer hover:opacity-85 transition-opacity"
                        onClick={(entry: any) => {
                          const courseId = entry?.courseId || entry?.payload?.courseId;
                          if (courseId) handleBarClick(courseId);
                        }}
                      />
                    </BarChart>
                  </ChartContainer>
                </div>
              )}
            </CardContent>
          </div>

          <div className="px-4 py-2.5 sm:px-5 border-t border-border/80 bg-muted/20 rounded-b-xl flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="truncate">
              Klik pada bar mata kuliah untuk membuka daftar tugas terkait.
            </span>
            <span className="font-medium shrink-0 ml-2">Urutan beban terbanyak</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
