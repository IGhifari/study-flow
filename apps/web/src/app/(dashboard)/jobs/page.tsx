'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Activity,
  Search,
  RefreshCw,
  AlertCircle,
  X,
  Eye,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Info,
  Server,
  FileText,
  User,
  Download,
  RotateCcw,
  Trash2,
  Loader2,
  MoreHorizontal,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { FadeIn, StaggerGroup, StaggerItem } from '@/components/ui/motion';
import {
  fetchAdminJobs,
  fetchAdminJobDetail,
  fetchAdminQueuesSummary,
  retryAdminJobApi,
  deleteAdminJobApi,
  cleanupAdminJobsApi,
} from '@/lib/admin-api';
import {
  AdminJobListItem,
  AdminJobListResponse,
  AdminJobDetail,
  AdminQueuesSummaryResponse,
  AdminJobType,
  AdminJobStatus,
  AdminCleanupJobsInputSchema,
} from '@studyflow/shared';
import {
  downloadCsvFile,
  formatJobDuration,
  formatLocalDateTime,
  getJobTypeLabel,
} from '@/lib/admin-formatters';
import { JobStatusBadge } from '@/components/admin/jobs/job-status-badge';
import { JobDetailSheet } from '@/components/admin/jobs/job-detail-sheet';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { toast } from 'sonner';

function JobsSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-36 rounded-lg" />
        <Skeleton className="h-36 rounded-lg" />
      </div>
      <div className="hidden md:block rounded-lg border border-border p-4 space-y-4">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 6 }).map((_, idx) => (
          <Skeleton key={idx} className="h-12 w-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Skeleton key={idx} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function AdminJobsContent() {
  const searchParams = useSearchParams();

  // Read initial filter values from URL search params
  const initialPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const initialLimit = [10, 20, 50].includes(Number(searchParams.get('limit')))
    ? Number(searchParams.get('limit'))
    : 20;
  const initialStatus = (searchParams.get('status') as AdminJobStatus) || '';
  const initialType = (searchParams.get('type') as AdminJobType) || '';
  const initialSearch = searchParams.get('search') || '';
  const initialSelectedId = searchParams.get('jobId') || null;

  // State
  const [page, setPage] = React.useState(initialPage);
  const [limit, setLimit] = React.useState(initialLimit);
  const [status, setStatus] = React.useState<string>(initialStatus);
  const [type, setType] = React.useState<string>(initialType);
  const [searchInput, setSearchInput] = React.useState<string>(initialSearch);
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 300, () => setPage(1));

  // Data states
  const [jobsData, setJobsData] = React.useState<AdminJobListResponse | null>(null);
  const [isJobsLoading, setIsJobsLoading] = React.useState(true);
  const [jobsError, setJobsError] = React.useState<string | null>(null);

  const [queuesData, setQueuesData] = React.useState<AdminQueuesSummaryResponse | null>(null);
  const [isQueuesLoading, setIsQueuesLoading] = React.useState(true);
  const [queuesError, setQueuesError] = React.useState<string | null>(null);

  // Detail Sheet state
  const [selectedJobId, setSelectedJobId] = React.useState<string | null>(initialSelectedId);
  const [jobDetail, setJobDetail] = React.useState<AdminJobDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = React.useState(false);
  const [detailError, setDetailError] = React.useState<string | null>(null);

  const [isExporting, setIsExporting] = React.useState(false);

  // Cleanup & operational action states
  const [isCleanupOpen, setIsCleanupOpen] = React.useState(false);
  const [cleanupStatus, setCleanupStatus] = React.useState<'FAILED' | 'COMPLETED'>('FAILED');
  const [cleanupOlderThanDays, setCleanupOlderThanDays] = React.useState<number>(0);
  const [isCleaningUp, setIsCleaningUp] = React.useState(false);
  const [cleanupError, setCleanupError] = React.useState<string | null>(null);

  const handleCleanupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCleanupError(null);

    const validationResult = AdminCleanupJobsInputSchema.safeParse({
      status: cleanupStatus,
      olderThanDays: cleanupOlderThanDays,
    });

    if (!validationResult.success) {
      setCleanupError(validationResult.error.issues[0]?.message || 'Input pembersihan tidak valid');
      return;
    }

    setIsCleaningUp(true);
    try {
      const res = await cleanupAdminJobsApi(validationResult.data);
      toast.success(`${res.deletedCount} riwayat pekerjaan berhasil dibersihkan`);
      setIsCleanupOpen(false);
      handleRefreshAll();
    } catch (err: unknown) {
      setCleanupError(err instanceof Error ? err.message : 'Gagal membersihkan riwayat pekerjaan');
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      await retryAdminJobApi(jobId);
      toast.success(`Pekerjaan ${jobId.slice(0, 8)} berhasil dijadwalkan ulang`);
      handleRefreshAll();
    } catch (err: unknown) {
      toast.error('Gagal mencoba ulang pekerjaan: ' + (err instanceof Error ? err.message : 'Kesalahan tidak diketahui'));
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    try {
      await deleteAdminJobApi(jobId);
      toast.success(`Riwayat pekerjaan ${jobId.slice(0, 8)} berhasil dihapus`);
      handleRefreshAll();
    } catch (err: unknown) {
      toast.error('Gagal menghapus riwayat pekerjaan: ' + (err instanceof Error ? err.message : 'Kesalahan tidak diketahui'));
    }
  };

  const handleExportJobsCsv = async () => {
    try {
      setIsExporting(true);
      const allJobs: AdminJobListItem[] = [];
      let currentPage = 1;
      let hasMore = true;

      while (hasMore && allJobs.length < 1000) {
        const response = await fetchAdminJobs({
          page: currentPage,
          limit: 100,
          status: (status as AdminJobStatus) || undefined,
          type: (type as AdminJobType) || undefined,
          search: debouncedSearch.trim() || undefined,
        });

        allJobs.push(...response.items);
        if (currentPage >= response.pagination.totalPages || response.items.length === 0) {
          hasMore = false;
        } else {
          currentPage += 1;
        }
      }

      const headers = [
        'ID Pekerjaan',
        'Jenis Pekerjaan',
        'Status',
        'Pengguna ID',
        'Nama Pengguna',
        'Materi ID',
        'Percobaan',
        'Batas Percobaan',
        'Durasi (ms)',
        'Kode Error',
        'Pesan Error',
        'Waktu Dibuat',
        'Waktu Mulai',
        'Waktu Selesai',
      ];

      const rows = allJobs.map((j) => [
        j.id,
        j.type,
        j.status,
        j.userId,
        j.userName,
        j.materialId || '-',
        j.attempts,
        j.maxAttempts,
        j.durationMs !== null ? j.durationMs : '-',
        j.errorCode || '-',
        j.safeErrorMessage || '-',
        new Date(j.createdAt).toLocaleString('id-ID'),
        j.startedAt ? new Date(j.startedAt).toLocaleString('id-ID') : '-',
        j.completedAt
          ? new Date(j.completedAt).toLocaleString('id-ID')
          : j.failedAt
          ? new Date(j.failedAt).toLocaleString('id-ID')
          : '-',
      ]);

      downloadCsvFile(
        `studyflow-jobs-${new Date().toISOString().split('T')[0]}.csv`,
        [headers, ...rows]
      );
    } catch (err: unknown) {
      console.error('Failed to export jobs CSV:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Synchronize state to URL query parameters
  React.useEffect(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set('page', String(page));
    if (limit !== 20) params.set('limit', String(limit));
    if (status) params.set('status', status);
    if (type) params.set('type', type);
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (selectedJobId) params.set('jobId', selectedJobId);

    const qs = params.toString();
    const newUrl = qs ? `/jobs?${qs}` : '/jobs';
    window.history.replaceState(null, '', newUrl);
  }, [page, limit, status, type, debouncedSearch, selectedJobId]);

  // Fetch queue summary
  const loadQueuesSummary = React.useCallback((signal?: AbortSignal) => {
    setIsQueuesLoading(true);
    setQueuesError(null);

    fetchAdminQueuesSummary({ signal })
      .then((res) => {
        if (!signal?.aborted) setQueuesData(res);
      })
      .catch((err: unknown) => {
        if (!signal?.aborted) setQueuesError(err instanceof Error ? err.message : 'Gagal memuat status antrean');
      })
      .finally(() => {
        if (!signal?.aborted) setIsQueuesLoading(false);
      });
  }, []);

  // Fetch jobs list
  const loadJobs = React.useCallback((signal?: AbortSignal) => {
    setIsJobsLoading(true);
    setJobsError(null);

    fetchAdminJobs(
      {
        page,
        limit,
        status: (status as AdminJobStatus) || undefined,
        type: (type as AdminJobType) || undefined,
        search: debouncedSearch.trim() || undefined,
      },
      { signal }
    )
      .then((res) => {
        if (!signal?.aborted) setJobsData(res);
      })
      .catch((err: unknown) => {
        if (!signal?.aborted) setJobsError(err instanceof Error ? err.message : 'Gagal memuat daftar pekerjaan');
      })
      .finally(() => {
        if (!signal?.aborted) setIsJobsLoading(false);
      });
  }, [page, limit, status, type, debouncedSearch]);

  // Initial and reactive data fetching with cancellation
  React.useEffect(() => {
    const controller = new AbortController();
    loadQueuesSummary(controller.signal);
    loadJobs(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadQueuesSummary, loadJobs]);

  // Fetch single job detail when selectedJobId changes
  React.useEffect(() => {
    if (!selectedJobId) {
      setJobDetail(null);
      return;
    }

    const controller = new AbortController();
    setIsDetailLoading(true);
    setDetailError(null);

    fetchAdminJobDetail(selectedJobId, { signal: controller.signal })
      .then((res) => {
        if (!controller.signal.aborted) setJobDetail(res);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setDetailError(err instanceof Error ? err.message : 'Gagal memuat rincian pekerjaan');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsDetailLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [selectedJobId]);

  const handleRefreshAll = () => {
    loadQueuesSummary();
    loadJobs();
    if (selectedJobId) {
      setIsDetailLoading(true);
      fetchAdminJobDetail(selectedJobId)
        .then((res) => setJobDetail(res))
        .catch((err: unknown) => setDetailError(err instanceof Error ? err.message : 'Gagal memuat rincian'))
        .finally(() => setIsDetailLoading(false));
    }
  };

  const totalPages = jobsData?.pagination.totalPages || 1;
  const totalItems = jobsData?.pagination.totalItems || 0;

  return (
    <FadeIn className="flex flex-1 flex-col gap-6 p-4 md:p-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Monitoring Pekerjaan & Antrean
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pantau status operasional antrean BullMQ dan riwayat pemrosesan dokumen serta AI.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCleanupOpen(true)}
            className="gap-2 text-destructive hover:bg-destructive/10 h-9"
          >
            <Trash2 className="h-4 w-4" />
            <span>Bersihkan Riwayat</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportJobsCsv}
            disabled={isExporting || isJobsLoading}
            className="gap-2 h-9"
          >
            <Download className={`h-4 w-4 ${isExporting ? 'animate-bounce' : ''}`} />
            <span>{isExporting ? 'Mengekspor...' : 'Ekspor CSV'}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={isJobsLoading || isQueuesLoading}
            className="gap-2 h-9"
          >
            <RefreshCw
              className={`h-4 w-4 ${isJobsLoading || isQueuesLoading ? 'animate-spin' : ''}`}
            />
            <span>Segarkan</span>
          </Button>
        </div>
      </div>

      {/* Queue Summary Cards */}
      {queuesData?.queues ? (
        <StaggerGroup className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {queuesData.queues.map((q) => (
            <StaggerItem key={q.name}>
              <Card className="h-full border-border bg-card shadow-xs">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {q.name.includes('document') ? (
                        <FileText className="h-5 w-5 text-primary" />
                      ) : (
                        <Server className="h-5 w-5 text-primary" />
                      )}
                      <CardTitle className="text-base font-semibold">{q.label}</CardTitle>
                    </div>
                    {q.status === 'available' ? (
                      <Badge variant="outline" className="bg-success text-success-foreground border-transparent text-xs">
                        Tersambung
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-xs">
                        Tidak Tersedia
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs">{q.retentionNote}</CardDescription>
                </CardHeader>
                <CardContent>
                  {q.status === 'available' && q.counts ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div className="rounded-md border border-border/70 p-2 bg-muted/20">
                        <span className="text-lg font-bold text-foreground block tabular-nums">
                          {q.counts.waiting}
                        </span>
                        <span className="text-xs text-muted-foreground block mt-0.5">Menunggu</span>
                      </div>
                      <div className="rounded-md border border-border/70 p-2 bg-muted/20">
                        <span className="text-lg font-bold text-primary block tabular-nums">
                          {q.counts.active}
                        </span>
                        <span className="text-xs text-muted-foreground block mt-0.5">Aktif</span>
                      </div>
                      <div className="rounded-md border border-border/70 p-2 bg-muted/20">
                        <span className="text-lg font-bold text-warning-foreground block tabular-nums">
                          {q.counts.delayed}
                        </span>
                        <span className="text-xs text-muted-foreground block mt-0.5">Tertunda</span>
                      </div>
                      <div className="rounded-md border border-border/70 p-2 bg-muted/20">
                        <span className="text-lg font-bold text-destructive block tabular-nums">
                          {q.counts.failed}
                        </span>
                        <span className="text-xs text-muted-foreground block mt-0.5">Gagal</span>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-md border border-border/70 p-3 bg-muted/10 text-center text-xs text-muted-foreground">
                      Status antrean BullMQ saat ini tidak dapat dihubungi atau Redis offline.
                    </div>
                  )}
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerGroup>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, idx) => (
            <Card key={idx}>
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-60" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 4 }).map((__, i) => (
                    <Skeleton key={i} className="h-14 rounded-md" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Notice on Retention */}
      <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <span>
          <strong>Catatan Operasional:</strong> Angka antrean di atas merefleksikan kondisi memori saat ini pada BullMQ Redis dan dibatasi oleh kebijakan retensi. Riwayat pekerjaan permanen dan kegagalan jangka panjang tercatat lengkap pada tabel basis data di bawah.
        </span>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <Select
            value={status || 'ALL'}
            onValueChange={(val) => {
              setStatus(val === 'ALL' ? '' : val);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-36 h-9 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Status</SelectItem>
              <SelectItem value="PENDING">Menunggu</SelectItem>
              <SelectItem value="PROCESSING">Diproses</SelectItem>
              <SelectItem value="COMPLETED">Selesai</SelectItem>
              <SelectItem value="FAILED">Gagal</SelectItem>
            </SelectContent>
          </Select>

          {/* Type Filter */}
          <Select
            value={type || 'ALL'}
            onValueChange={(val) => {
              setType(val === 'ALL' ? '' : val);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-48 h-9 text-xs">
              <SelectValue placeholder="Jenis Pekerjaan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Jenis</SelectItem>
              <SelectItem value="DOCUMENT_EXTRACTION">Ekstraksi Dokumen</SelectItem>
              <SelectItem value="DOCUMENT_CLEANUP">Pembersihan Dokumen</SelectItem>
              <SelectItem value="AI_SUMMARY_GENERATION">Ringkasan AI</SelectItem>
              <SelectItem value="AI_FLASHCARD_GENERATION">Flashcard AI</SelectItem>
              <SelectItem value="AI_QUIZ_GENERATION">Kuis AI</SelectItem>
            </SelectContent>
          </Select>

          {/* Reset button if filter is active */}
          {(status || type || debouncedSearch) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatus('');
                setType('');
                setSearchInput('');
                setPage(1);
              }}
              className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Reset Filter
            </Button>
          )}
        </div>

        {/* Search by Job ID, User ID, or User Name */}
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari ID Pekerjaan, ID Pengguna, atau Nama..."
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
            className="pl-9 pr-8 text-xs h-9"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                setPage(1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {jobsError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Terjadi Kesalahan</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4 mt-2">
            <span>{jobsError}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadJobs()}
              className="bg-card text-foreground"
            >
              Coba Lagi
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Jobs Presentation: Desktop Table (>= 768px) */}
      <Card className="hidden md:block overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-[180px]">ID Pekerjaan</TableHead>
                <TableHead className="w-[180px]">Jenis</TableHead>
                <TableHead className="min-w-[160px]">Pengguna</TableHead>
                <TableHead className="w-[120px]">Status DB</TableHead>
                <TableHead className="w-[90px]">Attempt</TableHead>
                <TableHead className="w-[90px]">Durasi</TableHead>
                <TableHead className="w-[180px]">Waktu Dibuat</TableHead>
                <TableHead className="w-[80px] text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isJobsLoading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-28 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : jobsData && jobsData.items.length > 0 ? (
                jobsData.items.map((job: AdminJobListItem) => (
                  <TableRow
                    key={job.id}
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={() => setSelectedJobId(job.id)}
                  >
                    <TableCell className="font-mono text-xs text-foreground font-medium">
                      <span className="truncate block max-w-[150px]" title={job.id}>
                        {job.id}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal text-xs whitespace-nowrap">
                        {getJobTypeLabel(job.type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/users/${job.userId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-foreground hover:underline hover:text-primary transition-colors block truncate max-w-[180px]"
                        title={job.userName}
                      >
                        {job.userName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <JobStatusBadge status={job.status} safeErrorMessage={job.safeErrorMessage} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono tabular-nums">
                      {job.attempts} / {job.maxAttempts}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono tabular-nums">
                      {formatJobDuration(job.durationMs)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                      {formatLocalDateTime(job.createdAt, true)}
                    </TableCell>
                    <TableCell className="text-right py-2.5" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 p-0" aria-label={`Aksi untuk pekerjaan ${job.id}`}>
                            <span className="sr-only">Buka menu aksi</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem
                            onClick={() => setSelectedJobId(job.id)}
                            className="cursor-pointer text-xs"
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            <span>Lihat Detail</span>
                          </DropdownMenuItem>

                          {job.status === 'FAILED' && (
                            <DropdownMenuItem
                              onClick={() => handleRetryJob(job.id)}
                              className="cursor-pointer text-xs"
                            >
                              <RotateCcw className="mr-2 h-4 w-4 text-warning-foreground" />
                              <span>Coba Ulang</span>
                            </DropdownMenuItem>
                          )}

                          {(job.status === 'FAILED' || job.status === 'COMPLETED') && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDeleteJob(job.id)}
                                className="cursor-pointer text-xs text-destructive focus:bg-destructive/10 focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>Hapus Riwayat</span>
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="h-40 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Activity className="h-8 w-8 text-muted-foreground/50" />
                      <p className="text-sm font-medium text-foreground">
                        Tidak ada riwayat pekerjaan ditemukan
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {debouncedSearch || status || type
                          ? 'Coba sesuaikan kata kunci pencarian atau filter status yang dipilih.'
                          : 'Belum ada antrean pekerjaan yang tercatat pada sistem.'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Mobile Cards View (< 768px) */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {isJobsLoading ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-40 w-full rounded-xl" />
          ))
        ) : jobsData && jobsData.items.length > 0 ? (
          jobsData.items.map((job: AdminJobListItem) => (
            <Card
              key={job.id}
              className="border-border bg-card shadow-xs p-4 flex flex-col justify-between gap-3 cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => setSelectedJobId(job.id)}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <Badge variant="secondary" className="font-medium text-xs mb-1">
                      {getJobTypeLabel(job.type)}
                    </Badge>
                    <p className="text-xs text-muted-foreground font-mono truncate" title={job.id}>
                      ID: {job.id}
                    </p>
                  </div>
                  <JobStatusBadge status={job.status} safeErrorMessage={job.safeErrorMessage} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/50">
                  <div>
                    <span className="text-muted-foreground block">Pengguna</span>
                    <Link
                      href={`/users/${job.userId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-medium text-primary hover:underline truncate block"
                    >
                      {job.userName}
                    </Link>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Percobaan</span>
                    <span className="font-mono text-foreground tabular-nums">
                      {job.attempts} / {job.maxAttempts}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Durasi</span>
                    <span className="font-mono text-foreground tabular-nums">
                      {formatJobDuration(job.durationMs)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Waktu Dibuat</span>
                    <span className="text-foreground tabular-nums">
                      {formatLocalDateTime(job.createdAt, false)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div
                className="flex items-center gap-2 border-t border-border/60 pt-2.5 mt-1"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedJobId(job.id)}
                  className="flex-1 h-10 text-xs gap-1.5 font-medium"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Detail</span>
                </Button>

                {job.status === 'FAILED' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRetryJob(job.id)}
                    className="h-10 px-3.5 text-xs gap-1.5 text-warning-foreground border-warning/30 hover:bg-warning/10 font-medium"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Coba Ulang</span>
                  </Button>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 px-3.5 text-xs shrink-0"
                      aria-label={`Aksi untuk pekerjaan ${job.id}`}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onClick={() => setSelectedJobId(job.id)}
                      className="cursor-pointer text-xs"
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      <span>Lihat Detail</span>
                    </DropdownMenuItem>

                    {job.status === 'FAILED' && (
                      <DropdownMenuItem
                        onClick={() => handleRetryJob(job.id)}
                        className="cursor-pointer text-xs"
                      >
                        <RotateCcw className="mr-2 h-4 w-4 text-warning-foreground" />
                        <span>Coba Ulang</span>
                      </DropdownMenuItem>
                    )}

                    {(job.status === 'FAILED' || job.status === 'COMPLETED') && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteJob(job.id)}
                          className="cursor-pointer text-xs text-destructive focus:bg-destructive/10 focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          <span>Hapus Riwayat</span>
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          ))
        ) : (
          <Card className="p-8 text-center border-border bg-card shadow-xs">
            <Activity className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="font-medium text-foreground text-sm">
              Tidak ada riwayat pekerjaan ditemukan
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {debouncedSearch || status || type
                ? 'Coba sesuaikan kata kunci pencarian atau filter status yang dipilih.'
                : 'Belum ada antrean pekerjaan yang tercatat pada sistem.'}
            </p>
            {(debouncedSearch || status || type) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatus('');
                  setType('');
                  setSearchInput('');
                  setPage(1);
                }}
                className="mt-3 text-xs"
              >
                Hapus Filter
              </Button>
            )}
          </Card>
        )}
      </div>

      {/* Pagination Footer */}
      <AdminPagination
        page={page}
        limit={limit}
        totalItems={totalItems}
        totalPages={totalPages}
        currentItemsCount={jobsData?.items.length ?? 0}
        itemLabel="pekerjaan"
        isLoading={isJobsLoading}
        onPageChange={setPage}
      />

      {/* Slide-over Sheet for Job Operational Detail */}
      <JobDetailSheet
        selectedJobId={selectedJobId}
        onClose={() => setSelectedJobId(null)}
        onRetry={() => selectedJobId && setSelectedJobId(selectedJobId)}
        onJobActionCompleted={handleRefreshAll}
        isDetailLoading={isDetailLoading}
        detailError={detailError}
        jobDetail={jobDetail}
      />

      {/* Cleanup Dialog */}
      <Dialog open={isCleanupOpen} onOpenChange={setIsCleanupOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Bersihkan Riwayat Pekerjaan
            </DialogTitle>
            <DialogDescription>
              Hapus massal catatan riwayat pemrosesan latar belakang yang telah selesai atau gagal secara permanen.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCleanupSubmit} className="space-y-4 py-2">
            {cleanupError && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{cleanupError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Status Riwayat yang Dibersihkan</Label>
              <Select
                value={cleanupStatus}
                onValueChange={(val: 'FAILED' | 'COMPLETED') => setCleanupStatus(val)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FAILED" className="text-xs">Hanya Pekerjaan Gagal (FAILED)</SelectItem>
                  <SelectItem value="COMPLETED" className="text-xs">Hanya Pekerjaan Selesai (COMPLETED)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Batas Usia Riwayat</Label>
              <Select
                value={String(cleanupOlderThanDays)}
                onValueChange={(val) => setCleanupOlderThanDays(Number(val))}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0" className="text-xs">Semua riwayat (0 hari / hapus seluruhnya)</SelectItem>
                  <SelectItem value="7" className="text-xs">Lebih dari 7 hari yang lalu</SelectItem>
                  <SelectItem value="30" className="text-xs">Lebih dari 30 hari yang lalu</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCleanupOpen(false)}
                disabled={isCleaningUp}
                className="h-9 text-xs"
              >
                Batal
              </Button>
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                disabled={isCleaningUp}
                className="h-9 text-xs gap-1.5"
              >
                {isCleaningUp && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Bersihkan Riwayat</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </FadeIn>
  );
}

export default function AdminJobsPage() {
  return (
    <React.Suspense fallback={<JobsSkeleton />}>
      <AdminJobsContent />
    </React.Suspense>
  );
}
