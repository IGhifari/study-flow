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
  Sparkles,
  User,
  Download,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  fetchAdminJobs,
  fetchAdminJobDetail,
  fetchAdminQueuesSummary,
} from '@/lib/admin-api';
import {
  AdminJobListItem,
  AdminJobListResponse,
  AdminJobDetail,
  AdminQueuesSummaryResponse,
  AdminJobType,
  AdminJobStatus,
  AdminQueueStatus,
} from '@studyflow/shared';

function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined || ms < 0) return '-';
  if (ms < 1000) return `${ms}ms`;
  const sec = (ms / 1000).toFixed(1);
  return `${sec}s`;
}

function formatDateTimeWithTz(isoString: string | null): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return `${d.toLocaleString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })} WIB`;
  } catch {
    return isoString;
  }
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

function renderDatabaseStatusBadge(status: AdminJobStatus) {
  switch (status) {
    case 'PENDING':
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800 text-xs gap-1">
          <Clock className="h-3 w-3" />
          Menunggu
        </Badge>
      );
    case 'PROCESSING':
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 text-xs gap-1">
          <Activity className="h-3 w-3 animate-pulse" />
          Diproses
        </Badge>
      );
    case 'COMPLETED':
      return (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 text-xs gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Selesai
        </Badge>
      );
    case 'FAILED':
      return (
        <Badge variant="danger" className="text-xs gap-1">
          <XCircle className="h-3 w-3" />
          Gagal
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function renderQueueStatusBadge(queueStatus: AdminQueueStatus) {
  switch (queueStatus) {
    case 'waiting':
      return (
        <Badge variant="outline" className="text-xs bg-muted/60 text-muted-foreground border-border">
          Antrean: Menunggu
        </Badge>
      );
    case 'active':
      return (
        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300">
          Antrean: Aktif
        </Badge>
      );
    case 'delayed':
      return (
        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300">
          Antrean: Tertunda
        </Badge>
      );
    case 'completed':
      return (
        <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">
          Antrean: Selesai
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="outline" className="text-xs bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300">
          Antrean: Gagal
        </Badge>
      );
    case 'not_found':
      return (
        <Badge variant="secondary" className="text-xs font-normal">
          Dibersihkan dari Memori
        </Badge>
      );
    case 'unavailable':
      return (
        <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">
          Tidak Tersedia
        </Badge>
      );
    default:
      return <Badge variant="secondary">{queueStatus}</Badge>;
  }
}

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
      <div className="rounded-lg border border-border p-4 space-y-4">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 6 }).map((_, idx) => (
          <Skeleton key={idx} className="h-12 w-full" />
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
  const [debouncedSearch, setDebouncedSearch] = React.useState<string>(initialSearch);

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

  // Copy feedback state
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExportJobsCsv = async () => {
    try {
      setIsExporting(true);
      const allJobs: AdminJobListItem[] = [];
      let currentPage = 1;
      let hasMore = true;

      while (hasMore && allJobs.length < 1000) {
        const isSearchJobId = debouncedSearch.length > 20 && !debouncedSearch.startsWith('usr_');
        const isSearchUserId = debouncedSearch.startsWith('usr_') || debouncedSearch.length > 20;

        const response = await fetchAdminJobs({
          page: currentPage,
          limit: 100,
          status: (status as AdminJobStatus) || undefined,
          type: (type as AdminJobType) || undefined,
          jobId: isSearchJobId ? debouncedSearch : undefined,
          userId: !isSearchJobId && isSearchUserId ? debouncedSearch : undefined,
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

      const escapeCsv = (str: string | number | null | undefined) => {
        if (str === null || str === undefined) return '""';
        const escaped = String(str).replace(/"/g, '""');
        return `"${escaped}"`;
      };

      const rows = allJobs.map((j) => [
        escapeCsv(j.id),
        escapeCsv(j.type),
        escapeCsv(j.status),
        escapeCsv(j.userId),
        escapeCsv(j.userName),
        escapeCsv(j.materialId || '-'),
        escapeCsv(j.attempts),
        escapeCsv(j.maxAttempts),
        escapeCsv(j.durationMs !== null ? j.durationMs : '-'),
        escapeCsv(j.errorCode || '-'),
        escapeCsv(j.safeErrorMessage || '-'),
        escapeCsv(new Date(j.createdAt).toLocaleString('id-ID')),
        escapeCsv(j.startedAt ? new Date(j.startedAt).toLocaleString('id-ID') : '-'),
        escapeCsv(
          j.completedAt
            ? new Date(j.completedAt).toLocaleString('id-ID')
            : j.failedAt
            ? new Date(j.failedAt).toLocaleString('id-ID')
            : '-'
        ),
      ]);

      const csvContent =
        '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `studyflow-jobs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Failed to export jobs CSV:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((curr) => (curr === key ? null : curr));
    }, 2000);
  };

  // Debounce search input
  React.useEffect(() => {
    const handler = setTimeout(() => {
      const trimmed = searchInput.trim();
      setDebouncedSearch((prev) => {
        if (prev !== trimmed) {
          setPage(1);
        }
        return trimmed;
      });
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

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
      .catch((err: any) => {
        if (!signal?.aborted) setQueuesError(err.message || 'Gagal memuat status antrean');
      })
      .finally(() => {
        if (!signal?.aborted) setIsQueuesLoading(false);
      });
  }, []);

  // Fetch jobs list
  const loadJobs = React.useCallback((signal?: AbortSignal) => {
    setIsJobsLoading(true);
    setJobsError(null);

    // If search looks like a CUID / ID, we can query by jobId or userId
    const isSearchJobId = debouncedSearch.length > 20 && !debouncedSearch.startsWith('usr_');
    const isSearchUserId = debouncedSearch.startsWith('usr_') || debouncedSearch.length > 20;

    fetchAdminJobs(
      {
        page,
        limit,
        status: (status as AdminJobStatus) || undefined,
        type: (type as AdminJobType) || undefined,
        jobId: isSearchJobId ? debouncedSearch : undefined,
        userId: !isSearchJobId && isSearchUserId ? debouncedSearch : undefined,
      },
      { signal }
    )
      .then((res) => {
        if (!signal?.aborted) setJobsData(res);
      })
      .catch((err: any) => {
        if (!signal?.aborted) setJobsError(err.message || 'Gagal memuat daftar pekerjaan');
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
      .catch((err: any) => {
        if (!controller.signal.aborted) {
          setDetailError(err.message || 'Gagal memuat rincian pekerjaan');
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
        .catch((err: any) => setDetailError(err.message || 'Gagal memuat rincian'))
        .finally(() => setIsDetailLoading(false));
    }
  };

  const totalPages = jobsData?.pagination.totalPages || 1;
  const totalItems = jobsData?.pagination.totalItems || 0;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 max-w-7xl mx-auto w-full">
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportJobsCsv}
            disabled={isExporting || isJobsLoading}
            className="gap-2"
          >
            <Download className={`h-4 w-4 ${isExporting ? 'animate-bounce' : ''}`} />
            <span>{isExporting ? 'Mengekspor...' : 'Ekspor CSV'}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={isJobsLoading || isQueuesLoading}
            className="gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${isJobsLoading || isQueuesLoading ? 'animate-spin' : ''}`}
            />
            <span>Segarkan</span>
          </Button>
        </div>
      </div>

      {/* Queue Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {queuesData?.queues.map((q) => (
          <Card key={q.name} className="border-border bg-card shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {q.name.includes('document') ? (
                    <FileText className="h-5 w-5 text-primary" />
                  ) : (
                    <Sparkles className="h-5 w-5 text-primary" />
                  )}
                  <CardTitle className="text-base font-semibold">{q.label}</CardTitle>
                </div>
                {q.status === 'available' ? (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 text-xs">
                    Tersambung
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 text-xs">
                    Tidak Tersedia
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs">{q.retentionNote}</CardDescription>
            </CardHeader>
            <CardContent>
              {q.status === 'available' && q.counts ? (
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="rounded-md border border-border/70 p-2 bg-muted/20">
                    <span className="text-lg font-bold text-foreground block">
                      {q.counts.waiting}
                    </span>
                    <span className="text-[11px] text-muted-foreground block mt-0.5">Menunggu</span>
                  </div>
                  <div className="rounded-md border border-border/70 p-2 bg-muted/20">
                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400 block">
                      {q.counts.active}
                    </span>
                    <span className="text-[11px] text-muted-foreground block mt-0.5">Aktif</span>
                  </div>
                  <div className="rounded-md border border-border/70 p-2 bg-muted/20">
                    <span className="text-lg font-bold text-amber-600 dark:text-amber-400 block">
                      {q.counts.delayed}
                    </span>
                    <span className="text-[11px] text-muted-foreground block mt-0.5">Tertunda</span>
                  </div>
                  <div className="rounded-md border border-border/70 p-2 bg-muted/20">
                    <span className="text-lg font-bold text-rose-600 dark:text-rose-400 block">
                      {q.counts.failed}
                    </span>
                    <span className="text-[11px] text-muted-foreground block mt-0.5">Gagal</span>
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-border/70 p-3 bg-muted/10 text-center text-xs text-muted-foreground">
                  Status antrean BullMQ saat ini tidak dapat dihubungi atau Redis offline.
                </div>
              )}
            </CardContent>
          </Card>
        )) || (
          Array.from({ length: 2 }).map((_, idx) => (
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
          ))
        )}
      </div>

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
                setDebouncedSearch('');
                setPage(1);
              }}
              className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Reset Filter
            </Button>
          )}
        </div>

        {/* Search by Job ID or User ID */}
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari ID Pekerjaan / ID Pengguna..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 pr-8 text-xs h-9"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
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

      {/* Jobs Table */}
      <div className="rounded-lg border border-border bg-card shadow-xs overflow-hidden">
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
                      {renderDatabaseStatusBadge(job.status)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {job.attempts} / {job.maxAttempts}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {formatDuration(job.durationMs)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTimeWithTz(job.createdAt)}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedJobId(job.id)}
                        className="h-8 px-2 text-xs gap-1"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Detail</span>
                      </Button>
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

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-border px-4 py-3 bg-card text-xs text-muted-foreground">
          <div>
            Menampilkan{' '}
            <span className="font-semibold text-foreground">
              {jobsData && jobsData.items.length > 0 ? (page - 1) * limit + 1 : 0}
            </span>{' '}
            hingga{' '}
            <span className="font-semibold text-foreground">
              {jobsData ? Math.min(page * limit, totalItems) : 0}
            </span>{' '}
            dari{' '}
            <span className="font-semibold text-foreground">
              {totalItems.toLocaleString('id-ID')}
            </span>{' '}
            pekerjaan
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isJobsLoading}
              className="h-8 px-2.5 gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Sebelumnya</span>
            </Button>
            <span className="px-2 font-medium text-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isJobsLoading}
              className="h-8 px-2.5 gap-1"
            >
              <span>Berikutnya</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Slide-over Sheet for Job Operational Detail */}
      <Sheet open={!!selectedJobId} onOpenChange={(open) => !open && setSelectedJobId(null)}>
        <SheetContent side="right" className="sm:max-w-md w-full overflow-y-auto">
          <SheetHeader className="text-left border-b border-border pb-4">
            <SheetTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Detail Pekerjaan Operasional
            </SheetTitle>
            <SheetDescription className="text-xs">
              Informasi pelacakan teknis dan riwayat eksekusi pekerjaan secara aman.
            </SheetDescription>
          </SheetHeader>

          {isDetailLoading ? (
            <div className="py-6 space-y-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : detailError ? (
            <div className="py-6 space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Gagal Memuat Detail</AlertTitle>
                <AlertDescription className="text-xs mt-1">{detailError}</AlertDescription>
              </Alert>
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectedJobId && setSelectedJobId(selectedJobId)}
                className="w-full"
              >
                Coba Lagi
              </Button>
            </div>
          ) : jobDetail ? (
            <div className="py-4 space-y-4 text-xs">
              {/* ID Pekerjaan */}
              <div className="rounded-md border border-border p-3 bg-muted/20">
                <span className="text-muted-foreground font-medium block">ID Pekerjaan</span>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <span className="font-mono text-xs text-foreground select-all break-all">
                    {jobDetail.id}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-xs gap-1 shrink-0"
                    onClick={() => handleCopy(jobDetail.id, 'jobId')}
                  >
                    {copiedKey === 'jobId' ? (
                      <Check className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Status Section */}
              <div className="rounded-md border border-border p-3 bg-muted/20 space-y-2">
                <span className="text-muted-foreground font-medium block">Status Operasional</span>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status Database (Permanen):</span>
                    {renderDatabaseStatusBadge(jobDetail.status)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status Antrean (BullMQ):</span>
                    {renderQueueStatusBadge(jobDetail.queueStatus)}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground/80 pt-1 border-t border-border/50">
                  Status antrean menandakan kondisi transien pada Redis. Jika job telah melewati batas retensi, antrean menampilkan &quot;Dibersihkan dari Memori&quot;.
                </p>
              </div>

              {/* Identitas Pengguna */}
              <div className="rounded-md border border-border p-3 bg-muted/20 space-y-1.5">
                <span className="text-muted-foreground font-medium block">Pengguna Terkait</span>
                <div className="flex items-center justify-between">
                  <span className="text-foreground font-semibold">{jobDetail.userName}</span>
                  <Button variant="outline" size="sm" asChild className="h-6 px-2 text-[11px]">
                    <Link href={`/users/${jobDetail.userId}`}>
                      <User className="h-3 w-3 mr-1" />
                      Profil
                    </Link>
                  </Button>
                </div>
                <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                  <span className="font-mono truncate max-w-[200px]">{jobDetail.userId}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1 text-[11px]"
                    onClick={() => handleCopy(jobDetail.userId, 'userId')}
                  >
                    {copiedKey === 'userId' ? 'Disalin' : 'Salin ID'}
                  </Button>
                </div>
              </div>

              {/* Job Metadata */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-border p-2.5 bg-muted/20">
                  <span className="text-muted-foreground block text-[11px]">Jenis Pekerjaan</span>
                  <span className="font-semibold text-foreground mt-0.5 block">
                    {getJobTypeLabel(jobDetail.type)}
                  </span>
                </div>
                <div className="rounded-md border border-border p-2.5 bg-muted/20">
                  <span className="text-muted-foreground block text-[11px]">Attempt</span>
                  <span className="font-semibold text-foreground font-mono mt-0.5 block">
                    {jobDetail.attempts} / {jobDetail.maxAttempts}
                  </span>
                </div>
              </div>

              {/* Timestamps */}
              <div className="rounded-md border border-border p-3 bg-muted/20 space-y-1.5">
                <span className="text-muted-foreground font-medium block">Jejak Waktu</span>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Waktu Dibuat:</span>
                    <span className="font-mono text-foreground">
                      {formatDateTimeWithTz(jobDetail.createdAt)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Waktu Mulai:</span>
                    <span className="font-mono text-foreground">
                      {formatDateTimeWithTz(jobDetail.startedAt)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Waktu Selesai:</span>
                    <span className="font-mono text-foreground">
                      {formatDateTimeWithTz(jobDetail.completedAt)}
                    </span>
                  </div>
                  {jobDetail.failedAt && (
                    <div className="flex justify-between text-destructive">
                      <span>Waktu Gagal:</span>
                      <span className="font-mono">
                        {formatDateTimeWithTz(jobDetail.failedAt)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-border/50 pt-1 mt-1">
                    <span className="text-muted-foreground font-medium">Durasi Eksekusi:</span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatDuration(jobDetail.durationMs)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Error Information (if failed) */}
              {jobDetail.status === 'FAILED' && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 space-y-1 text-xs text-destructive">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4" />
                    <span>Kode Kesalahan: {jobDetail.errorCode || 'UNKNOWN_ERROR'}</span>
                  </div>
                  <p className="text-[11px] text-foreground/80 mt-1 leading-relaxed">
                    {jobDetail.safeErrorMessage || 'Terjadi kegagalan operasional saat mengeksekusi pekerjaan.'}
                  </p>
                </div>
              )}

              {/* Privacy Notice */}
              <div className="rounded-md bg-muted/50 p-2.5 text-[11px] text-muted-foreground leading-relaxed">
                <span className="font-semibold block text-foreground mb-0.5">
                  Proteksi Privasi Pengguna:
                </span>
                Isi dokumen PDF, teks prompt, respons model AI mentah, kredensial, dan URL unduhan materi dilindungi secara ketat dan tidak diekspos melalui portal administrator.
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function AdminJobsPage() {
  return (
    <React.Suspense fallback={<JobsSkeleton />}>
      <AdminJobsContent />
    </React.Suspense>
  );
}
