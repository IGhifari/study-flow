'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  AlertCircle,
  Download,
  Loader2,
  FileText,
  Cpu,
  Activity,
  Clock,
  CheckCircle2,
  Users,
  ArrowRight,
  Eye,
  XCircle,
  Server,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SectionCards } from '@/components/section-cards';
import { DataTable } from '@/components/data-table';
import { FadeIn, StaggerGroup, StaggerItem } from '@/components/ui/motion';
import {
  fetchAdminSummary,
  fetchAdminSystemStatus,
  fetchAdminQueuesSummary,
  fetchAdminUsers,
  fetchAdminJobs,
} from '@/lib/admin-api';
import type {
  AdminSummary,
  AdminSystemStatusResponse,
  AdminQueuesSummaryResponse,
  AdminQueueSummaryItem,
  AdminUserListResponse,
  AdminJobListResponse,
  AdminJobType,
  AdminJobStatus,
} from '@studyflow/shared';

function formatLocalDateTime(isoString: string | null | undefined): string {
  if (!isoString) return '-';
  try {
    const date = new Date(isoString);
    return `${date.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })} WIB`;
  } catch {
    return isoString;
  }
}

function formatSyncTime(date: Date): string {
  return `${date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })} WIB`;
}

function formatJobDuration(durationMs: number | null): string {
  if (durationMs === null || durationMs === undefined || durationMs < 0) {
    return '-';
  }
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function getJobTypeLabel(type: AdminJobType): string {
  switch (type) {
    case 'DOCUMENT_EXTRACTION':
      return 'Ekstraksi Dokumen';
    case 'DOCUMENT_CLEANUP':
      return 'Pembersihan Dokumen';
    case 'AI_SUMMARY_GENERATION':
      return 'Ringkasan AI';
    case 'AI_FLASHCARD_GENERATION':
      return 'Flashcard AI';
    case 'AI_QUIZ_GENERATION':
      return 'Kuis AI';
    default:
      return type;
  }
}

function renderJobStatusBadge(status: AdminJobStatus, safeErrorMessage: string | null) {
  switch (status) {
    case 'COMPLETED':
      return (
        <Badge
          variant="outline"
          className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 text-xs font-medium"
        >
          <CheckCircle2 className="h-3 w-3 shrink-0" />
          <span>Selesai</span>
        </Badge>
      );
    case 'FAILED':
      return (
        <div className="flex flex-col items-start gap-1">
          <Badge
            variant="outline"
            className="gap-1 border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300 text-xs font-medium"
          >
            <XCircle className="h-3 w-3 shrink-0" />
            <span>Gagal</span>
          </Badge>
          {safeErrorMessage && (
            <span
              className="text-xs text-rose-600 dark:text-rose-400 line-clamp-1 max-w-[220px]"
              title={safeErrorMessage}
            >
              {safeErrorMessage}
            </span>
          )}
        </div>
      );
    case 'PROCESSING':
      return (
        <Badge
          variant="outline"
          className="gap-1 border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300 text-xs font-medium"
        >
          <Activity className="h-3 w-3 animate-pulse shrink-0" />
          <span>Diproses</span>
        </Badge>
      );
    case 'PENDING':
    default:
      return (
        <Badge
          variant="outline"
          className="gap-1 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300 text-xs font-medium"
        >
          <Clock className="h-3 w-3 shrink-0" />
          <span>Menunggu</span>
        </Badge>
      );
  }
}

const DEFAULT_QUEUE_CONFIGS: Array<{
  name: string;
  displayTitle: string;
  icon: 'document' | 'ai';
}> = [
  {
    name: 'document-processing',
    displayTitle: 'Pemrosesan Dokumen',
    icon: 'document',
  },
  {
    name: 'ai-generation',
    displayTitle: 'Generasi Konten AI',
    icon: 'ai',
  },
];

export default function AdminDashboardPage() {
  // Data states
  const [summary, setSummary] = React.useState<AdminSummary | null>(null);
  const [systemStatus, setSystemStatus] = React.useState<AdminSystemStatusResponse | null>(null);
  const [queuesSummary, setQueuesSummary] = React.useState<AdminQueuesSummaryResponse | null>(null);
  const [recentUsers, setRecentUsers] = React.useState<AdminUserListResponse | null>(null);
  const [recentJobs, setRecentJobs] = React.useState<AdminJobListResponse | null>(null);

  // Loading states
  const [isRefreshing, setIsRefreshing] = React.useState(true);
  const [isSummaryLoading, setIsSummaryLoading] = React.useState(true);
  const [isSystemLoading, setIsSystemLoading] = React.useState(true);
  const [isQueuesLoading, setIsQueuesLoading] = React.useState(true);
  const [isUsersLoading, setIsUsersLoading] = React.useState(true);
  const [isJobsLoading, setIsJobsLoading] = React.useState(true);
  const [isExporting, setIsExporting] = React.useState(false);

  // Error states
  const [summaryError, setSummaryError] = React.useState<string | null>(null);
  const [systemError, setSystemError] = React.useState<string | null>(null);
  const [queuesError, setQueuesError] = React.useState<string | null>(null);
  const [usersError, setUsersError] = React.useState<string | null>(null);
  const [jobsError, setJobsError] = React.useState<string | null>(null);
  const [exportError, setExportError] = React.useState<string | null>(null);

  // Last sync timestamp
  const [lastSyncedAt, setLastSyncedAt] = React.useState<string | null>(null);

  const loadAllDashboardData = React.useCallback(async () => {
    setIsRefreshing(true);
    setIsSummaryLoading(true);
    setIsSystemLoading(true);
    setIsQueuesLoading(true);
    setIsUsersLoading(true);
    setIsJobsLoading(true);

    setSummaryError(null);
    setSystemError(null);
    setQueuesError(null);
    setUsersError(null);
    setJobsError(null);

    const [summaryRes, systemRes, queuesRes, usersRes, jobsRes] = await Promise.allSettled([
      fetchAdminSummary(),
      fetchAdminSystemStatus(),
      fetchAdminQueuesSummary(),
      fetchAdminUsers({ limit: 5, sortBy: 'createdAt', sortOrder: 'desc' }),
      fetchAdminJobs({ limit: 5, sortBy: 'createdAt', sortOrder: 'desc' }),
    ]);

    if (summaryRes.status === 'fulfilled') {
      setSummary(summaryRes.value);
    } else {
      setSummaryError(
        summaryRes.reason?.message || 'Gagal memuat ringkasan statistik platform'
      );
    }
    setIsSummaryLoading(false);

    if (systemRes.status === 'fulfilled') {
      setSystemStatus(systemRes.value);
    } else {
      setSystemError(
        systemRes.reason?.message || 'Gagal memuat status komponen infrastruktur'
      );
    }
    setIsSystemLoading(false);

    if (queuesRes.status === 'fulfilled') {
      setQueuesSummary(queuesRes.value);
    } else {
      setQueuesError(
        queuesRes.reason?.message || 'Gagal memuat ringkasan antrean BullMQ/Redis'
      );
    }
    setIsQueuesLoading(false);

    if (usersRes.status === 'fulfilled') {
      setRecentUsers(usersRes.value);
    } else {
      setUsersError(
        usersRes.reason?.message || 'Gagal memuat daftar pendaftaran mahasiswa terbaru'
      );
    }
    setIsUsersLoading(false);

    if (jobsRes.status === 'fulfilled') {
      setRecentJobs(jobsRes.value);
    } else {
      setJobsError(
        jobsRes.reason?.message || 'Gagal memuat riwayat pekerjaan background terbaru'
      );
    }
    setIsJobsLoading(false);

    setLastSyncedAt(formatSyncTime(new Date()));
    setIsRefreshing(false);
  }, []);

  React.useEffect(() => {
    loadAllDashboardData();
  }, [loadAllDashboardData]);

  const handleExportCsv = React.useCallback(async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const [sum, sys, qSum] = await Promise.all([
        summary ? Promise.resolve(summary) : fetchAdminSummary(),
        systemStatus ? Promise.resolve(systemStatus) : fetchAdminSystemStatus(),
        queuesSummary ? Promise.resolve(queuesSummary) : fetchAdminQueuesSummary(),
      ]);

      const now = new Date();
      const dateStr = now.toISOString().replace(/[:.]/g, '-');

      const rows: string[][] = [
        ['LAPORAN OPERASIONAL TERPADU PLATFORM STUDYFLOW'],
        ['Waktu Ekspor', now.toISOString()],
        [],
        ['1. RINGKASAN METRIK PLATFORM'],
        ['Metrik', 'Nilai', 'Keterangan'],
        ['Total Pengguna', String(sum.totalUsers), 'Akun mahasiswa terdaftar'],
        ['Total Materi Kuliah', String(sum.totalMaterials), 'Bahan ajar aktif'],
        ['Total Tugas Akademik', String(sum.totalAssignments), 'Tugas perkuliahan terdistribusi'],
        ['Pekerjaan AI Gagal (24 Jam)', String(sum.failedJobs24h), 'Kesalahan ekstraksi / AI'],
        [],
        ['2. STATUS ANTREAN BULLMQ & REDIS'],
        ['Status Koneksi Redis', qSum.redisStatus === 'connected' ? 'Tersambung' : 'Tidak Tersedia'],
        ['Nama Antrean', 'Label', 'Status', 'Menunggu', 'Aktif', 'Tertunda', 'Gagal'],
      ];

      for (const q of qSum.queues) {
        rows.push([
          q.name,
          q.label,
          q.status,
          String(q.counts?.waiting ?? 0),
          String(q.counts?.active ?? 0),
          String(q.counts?.delayed ?? 0),
          String(q.counts?.failed ?? 0),
        ]);
      }

      rows.push(
        [],
        ['3. STATUS KESEHATAN INFRASTRUKTUR & MODUL'],
        ['ID Komponen', 'Nama Layanan', 'Kategori', 'Status', 'Engine / Runtime', 'Metrik Utama', 'Keterangan']
      );

      for (const m of sys.modules) {
        rows.push([
          m.id,
          m.name,
          m.category,
          m.status,
          m.engine,
          `${m.metricLabel}: ${m.metricValue}`,
          m.description,
        ]);
      }

      const csvContent = rows
        .map((row) =>
          row
            .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
            .join(',')
        )
        .join('\r\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `studyflow-laporan-admin-${dateStr.slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Kesalahan tidak diketahui';
      setExportError('Gagal mengekspor laporan: ' + message);
    } finally {
      setIsExporting(false);
    }
  }, [summary, systemStatus, queuesSummary]);

  const failedJobs24h = summary?.failedJobs24h ?? 0;
  const totalUsersCount = recentUsers?.pagination.totalItems ?? summary?.totalUsers ?? 0;

  return (
    <div className="flex flex-1 flex-col gap-6 py-6 w-full max-w-7xl mx-auto">
      {/* Header Bar with Unified Sync Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 lg:px-6">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Dashboard Administrator
            </h1>
            {lastSyncedAt && (
              <Badge
                variant="outline"
                className="text-xs font-normal text-muted-foreground border-border bg-muted/40 tabular-nums"
              >
                Terakhir disinkronkan: {lastSyncedAt}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Cockpit operasional terpadu untuk memantau antrean BullMQ/Redis, pendaftaran mahasiswa, dan eksekusi pekerjaan AI.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={loadAllDashboardData}
            disabled={isRefreshing}
            className="gap-2 h-9 px-3.5 text-xs md:text-sm shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Perbarui Data
          </Button>
        </div>
      </div>

      {/* Top-level Summary or Export Errors */}
      {(summaryError || exportError) && (
        <div className="px-4 lg:px-6 space-y-3">
          {summaryError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Gagal Memuat Ringkasan Statistik</AlertTitle>
              <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span>{summaryError}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadAllDashboardData}
                  className="bg-card text-foreground self-start sm:self-auto"
                >
                  Coba Lagi
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {exportError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Ekspor CSV Gagal</AlertTitle>
              <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span>{exportError}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCsv}
                  className="bg-card text-foreground self-start sm:self-auto"
                >
                  Coba Lagi
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* 1. Primary Metric Cards */}
      <FadeIn>
        <SectionCards summary={summary} isLoading={isSummaryLoading} />
      </FadeIn>

      {/* 2. Quick Action Bar (Tombol Pintas Tindakan Operasional) */}
      <section aria-label="Tindakan Cepat Operasional" className="px-4 lg:px-6">
        <StaggerGroup className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Quick Action 1: Tinjau Pekerjaan Gagal */}
          <StaggerItem>
            <Link
              href="/jobs?status=FAILED"
              className={`flex items-center justify-between gap-3 rounded-lg border p-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                failedJobs24h > 0
                  ? 'border-rose-500/40 bg-rose-500/5 hover:bg-rose-500/10'
                  : 'border-border bg-card hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${
                    failedJobs24h > 0
                      ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {failedJobs24h > 0 ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">
                    Tinjau Pekerjaan Gagal
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {failedJobs24h > 0
                      ? 'Perlu peninjauan segera (24j)'
                      : 'Semua pekerjaan normal'}
                  </p>
                </div>
              </div>
              {failedJobs24h > 0 ? (
                <Badge
                  variant="destructive"
                  className="shrink-0 tabular-nums font-semibold text-xs"
                >
                  {failedJobs24h.toLocaleString('id-ID')}
                </Badge>
              ) : (
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </Link>
          </StaggerItem>

          {/* Quick Action 2: Direktori Mahasiswa */}
          <StaggerItem>
            <Link
              href="/users"
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50 text-foreground">
                  <Users className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">
                    Direktori Mahasiswa
                  </p>
                  <p className="text-xs text-muted-foreground truncate tabular-nums">
                    {totalUsersCount.toLocaleString('id-ID')} akun terdaftar
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
          </StaggerItem>

          {/* Quick Action 3: Monitoring Antrean */}
          <StaggerItem>
            <Link
              href="/jobs"
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50 text-foreground">
                  <Activity className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">
                    Monitoring Antrean
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    Log eksekusi & status worker
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
          </StaggerItem>

          {/* Quick Action 4: Ekspor Laporan CSV */}
          <StaggerItem>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={isExporting}
              className="w-full flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3.5 text-left transition-colors hover:bg-muted/50 disabled:opacity-60 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50 text-foreground">
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">
                    Ekspor Laporan CSV
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {isExporting ? 'Menyiapkan berkas CSV...' : 'Unduh ringkasan operasional'}
                  </p>
                </div>
              </div>
            </button>
          </StaggerItem>
        </StaggerGroup>
      </section>

      {/* 3. Widget Monitoring Antrean BullMQ & Status Redis */}
      <FadeIn delay={0.04} className="px-4 lg:px-6" role="region" aria-label="Monitoring Antrean BullMQ & Status Redis">
        <Card className="border-border bg-card shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base font-semibold">
                  Monitoring Antrean BullMQ & Status Redis
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Koneksi Redis:</span>
                {isQueuesLoading && !queuesSummary ? (
                  <Skeleton className="h-5 w-24" />
                ) : queuesSummary?.redisStatus === 'connected' ? (
                  <Badge
                    variant="outline"
                    className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs font-medium"
                  >
                    Tersambung
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-xs font-medium"
                  >
                    Tidak Tersedia
                  </Badge>
                )}
              </div>
            </div>
            <CardDescription className="text-xs">
              Kondisi real-time antrean pekerja latar belakang di memori Redis.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {queuesError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Gagal Memuat Status Antrean BullMQ</AlertTitle>
                <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span>{queuesError}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadAllDashboardData}
                    className="bg-card text-foreground self-start sm:self-auto"
                  >
                    Coba Lagi
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {isQueuesLoading && !queuesSummary ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: 2 }).map((_, idx) => (
                  <div key={idx} className="rounded-lg border border-border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-5 w-44" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {Array.from({ length: 4 }).map((__, i) => (
                        <Skeleton key={i} className="h-16 rounded-md" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {DEFAULT_QUEUE_CONFIGS.map((cfg) => {
                  const matchedQueue: AdminQueueSummaryItem | undefined =
                    queuesSummary?.queues.find((q) => q.name === cfg.name);
                  const isAvailable = matchedQueue?.status === 'available';
                  const counts = matchedQueue?.counts;
                  const queueFailedCount = counts?.failed ?? 0;

                  return (
                    <div
                      key={cfg.name}
                      className="rounded-lg border border-border bg-muted/15 p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-card text-foreground">
                            {cfg.icon === 'document' ? (
                              <FileText className="h-4 w-4" />
                            ) : (
                              <Cpu className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-foreground">
                              {cfg.displayTitle}
                            </h3>
                            <p className="font-mono text-xs text-muted-foreground">
                              {cfg.name}
                            </p>
                          </div>
                        </div>
                        {isAvailable ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs"
                          >
                            Tersambung
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-xs"
                          >
                            Tidak Tersedia
                          </Badge>
                        )}
                      </div>

                      {isAvailable && counts ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {/* Menunggu (waiting) */}
                          <div className="rounded-md border border-border bg-card p-2.5">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Menunggu</span>
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <p className="mt-1 text-lg font-semibold text-muted-foreground tabular-nums">
                              {counts.waiting.toLocaleString('id-ID')}
                            </p>
                          </div>

                          {/* Aktif (active) */}
                          <div className="rounded-md border border-border bg-card p-2.5">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Aktif</span>
                              <Activity className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <p className="mt-1 text-lg font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
                              {counts.active.toLocaleString('id-ID')}
                            </p>
                          </div>

                          {/* Tertunda (delayed) */}
                          <div className="rounded-md border border-border bg-card p-2.5">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Tertunda</span>
                              <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <p className="mt-1 text-lg font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                              {counts.delayed.toLocaleString('id-ID')}
                            </p>
                          </div>

                          {/* Gagal (failed) */}
                          <div className="rounded-md border border-border bg-card p-2.5">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Gagal</span>
                              <AlertCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                            </div>
                            <p className="mt-1 text-lg font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                              {counts.failed.toLocaleString('id-ID')}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-md border border-border bg-card p-3 text-center text-xs text-muted-foreground">
                          Metrik antrean tidak tersedia saat koneksi Redis terputus.
                        </div>
                      )}

                      {queueFailedCount > 0 && (
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs text-rose-600 dark:text-rose-400 font-medium tabular-nums">
                            {queueFailedCount} pekerjaan gagal di antrean memori
                          </span>
                          <Button asChild variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                            <Link href="/jobs?status=FAILED">
                              Tinjau Antrean Gagal
                              <ArrowRight className="h-3 w-3" />
                            </Link>
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span>
                Antrean BullMQ bersifat transien dalam memori Redis; riwayat permanen tersimpan di database.
              </span>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* 4. Two-Column Operational Feeds: Recent Users & Recent Jobs */}
      <FadeIn delay={0.08} className="grid grid-cols-1 xl:grid-cols-2 gap-6 px-4 lg:px-6">
        {/* 4A. Feed Pendaftaran Mahasiswa Terbaru (Recent Users Feed) */}
        <Card className="border-border bg-card shadow-xs flex flex-col justify-between">
          <div>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold">
                  Pendaftaran Mahasiswa Terbaru
                </CardTitle>
                <Badge variant="secondary" className="text-xs font-normal tabular-nums">
                  5 Terbaru
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Aliran akun mahasiswa yang baru mendaftar ke platform StudyFlow.
              </CardDescription>
            </CardHeader>

            <CardContent>
              {usersError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Gagal Memuat Pendaftaran Terbaru</AlertTitle>
                  <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span>{usersError}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadAllDashboardData}
                      className="bg-card text-foreground self-start sm:self-auto"
                    >
                      Coba Lagi
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : isUsersLoading && !recentUsers ? (
                <div className="space-y-2.5">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Skeleton key={idx} className="h-10 w-full" />
                  ))}
                </div>
              ) : !recentUsers || recentUsers.items.length === 0 ? (
                <div className="rounded-lg border border-border/60 py-8 text-center text-sm text-muted-foreground">
                  Belum ada mahasiswa terdaftar
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="text-xs h-9">Nama Mahasiswa</TableHead>
                        <TableHead className="text-xs h-9">Alamat Email</TableHead>
                        <TableHead className="text-xs h-9">Status Verifikasi</TableHead>
                        <TableHead className="text-xs h-9">Tanggal Bergabung</TableHead>
                        <TableHead className="text-xs h-9 text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentUsers.items.map((user) => (
                        <TableRow key={user.id} className="hover:bg-muted/30">
                          <TableCell className="py-2.5 text-xs font-medium text-foreground">
                            {user.name}
                          </TableCell>
                          <TableCell className="py-2.5 font-mono text-xs text-muted-foreground">
                            {user.email}
                          </TableCell>
                          <TableCell className="py-2.5">
                            {user.emailVerifiedAt ? (
                              <Badge
                                variant="outline"
                                className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 text-xs font-medium"
                              >
                                <CheckCircle2 className="h-3 w-3 shrink-0" />
                                <span>Terverifikasi</span>
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="gap-1 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300 text-xs font-medium"
                              >
                                <Clock className="h-3 w-3 shrink-0" />
                                <span>Belum Verifikasi</span>
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                            {formatLocalDateTime(user.createdAt)}
                          </TableCell>
                          <TableCell className="py-2.5 text-right">
                            <Button
                              asChild
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                            >
                              <Link href={`/users/${user.id}`}>
                                <Eye className="h-3.5 w-3.5 mr-1" />
                                Detail
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </div>

          <CardFooter className="border-t border-border pt-3 flex items-center justify-between">
            <Link
              href="/users"
              className="text-xs font-medium text-primary hover:underline tabular-nums"
            >
              Lihat Semua Pengguna (Total: {totalUsersCount.toLocaleString('id-ID')}) &rarr;
            </Link>
          </CardFooter>
        </Card>

        {/* 4B. Feed Riwayat Pekerjaan Background Terbaru (Recent Jobs Feed) */}
        <Card className="border-border bg-card shadow-xs flex flex-col justify-between">
          <div>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold">
                  Riwayat Pekerjaan Background Terbaru
                </CardTitle>
                <Badge variant="secondary" className="text-xs font-normal tabular-nums">
                  5 Terbaru
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Eksekusi ekstraksi dokumen PDF dan pembuatan materi AI terbaru.
              </CardDescription>
            </CardHeader>

            <CardContent>
              {jobsError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Gagal Memuat Riwayat Pekerjaan</AlertTitle>
                  <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span>{jobsError}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadAllDashboardData}
                      className="bg-card text-foreground self-start sm:self-auto"
                    >
                      Coba Lagi
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : isJobsLoading && !recentJobs ? (
                <div className="space-y-2.5">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Skeleton key={idx} className="h-10 w-full" />
                  ))}
                </div>
              ) : !recentJobs || recentJobs.items.length === 0 ? (
                <div className="rounded-lg border border-border/60 py-8 text-center text-sm text-muted-foreground">
                  Belum ada riwayat pekerjaan background
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="text-xs h-9">ID Pekerjaan</TableHead>
                        <TableHead className="text-xs h-9">Jenis Pekerjaan</TableHead>
                        <TableHead className="text-xs h-9">Mahasiswa</TableHead>
                        <TableHead className="text-xs h-9">Status Eksekusi</TableHead>
                        <TableHead className="text-xs h-9 text-right">Durasi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentJobs.items.map((job) => (
                        <TableRow key={job.id} className="hover:bg-muted/30">
                          <TableCell className="py-2.5 font-mono text-xs text-muted-foreground">
                            <Link
                              href={`/jobs?jobId=${encodeURIComponent(job.id)}`}
                              title={job.id}
                              className="hover:text-foreground hover:underline"
                            >
                              {job.id.slice(0, 8)}
                            </Link>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <Badge variant="secondary" className="text-xs font-normal whitespace-nowrap">
                              {getJobTypeLabel(job.type)}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2.5 text-xs">
                            <Link
                              href={`/users/${job.userId}`}
                              className="font-medium text-foreground hover:text-primary hover:underline"
                            >
                              {job.userName}
                            </Link>
                          </TableCell>
                          <TableCell className="py-2.5">
                            {renderJobStatusBadge(job.status, job.safeErrorMessage)}
                          </TableCell>
                          <TableCell className="py-2.5 text-right font-mono text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                            {formatJobDuration(job.durationMs)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </div>

          <CardFooter className="border-t border-border pt-3 flex items-center justify-between">
            <Link
              href="/jobs"
              className="text-xs font-medium text-primary hover:underline"
            >
              Buka Monitoring Pekerjaan &rarr;
            </Link>
          </CardFooter>
        </Card>
      </FadeIn>

      {/* 5. Platform Modules & Health Table */}
      <FadeIn delay={0.12}>
        <DataTable
          externalModules={systemStatus?.modules ?? null}
          externalLoading={isSystemLoading}
          externalError={systemError}
          onRefresh={loadAllDashboardData}
        />
      </FadeIn>

      {/* 6. Technical Policy & Metrics Scope */}
      <div className="px-4 lg:px-6">
        <Card className="border-border bg-card shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Cakupan Data & Kebijakan Metrik</CardTitle>
            <CardDescription>
              Definisi teknis batas agregasi data yang disajikan pada dashboard administrator StudyFlow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              • <strong>Total Pengguna:</strong> Menghitung seluruh catatan akun mahasiswa aktif yang tersimpan pada database utama.
            </p>
            <p>
              • <strong>Total Materi:</strong> Menghitung dokumen pembelajaran aktif, mengecualikan dokumen dengan status soft-delete (deletedAt terisi).
            </p>
            <p>
              • <strong>Total Tugas:</strong> Seluruh item tugas akademik mahasiswa lintas semester.
            </p>
            <p>
              • <strong>Gagal AI (24 Jam):</strong> Pekerjaan antrean pemrosesan dokumen atau generasi AI yang berstatus FAILED dalam rentang waktu 24 jam terakhir.
            </p>
            {summary && (
              <p className="text-xs text-muted-foreground/80 pt-2 border-t border-border tabular-nums">
                Terakhir dihitung pada: {new Date(summary.calculatedAt).toLocaleString('id-ID')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
