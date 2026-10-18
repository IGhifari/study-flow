'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Search,
  ListTodo,
  RefreshCw,
  AlertCircle,
  X,
  ArrowUpDown,
  Download,
  CheckCircle2,
  Clock,
  CircleDot,
  AlertTriangle,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Card } from '@/components/ui/card';
import { FadeIn } from '@/components/ui/motion';
import { fetchAdminAssignments } from '@/lib/admin-api';
import { AdminAssignmentListItem, AdminAssignmentListResponse } from '@studyflow/shared';
import { downloadCsvFile } from '@/lib/admin-formatters';
import { AdminPagination } from '@/components/admin-pagination';

function AssignmentsTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Skeleton className="h-10 w-full sm:max-w-sm" />
        <Skeleton className="h-9 w-32 self-end sm:self-auto" />
      </div>
      <Card className="overflow-hidden shadow-xs">
        <div className="p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Skeleton key={idx} className="h-10 w-full" />
          ))}
        </div>
      </Card>
    </div>
  );
}

function StatusBadge({ status, isOverdue }: { status: string; isOverdue: boolean }) {
  if (status === 'DONE') {
    return (
      <Badge variant="outline" className="bg-success text-success-foreground border-transparent text-xs gap-1">
        <CheckCircle2 className="h-3 w-3" />
        <span>Selesai</span>
      </Badge>
    );
  }

  if (isOverdue) {
    return (
      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs gap-1">
        <AlertTriangle className="h-3 w-3" />
        <span>Terlewat (Overdue)</span>
      </Badge>
    );
  }

  if (status === 'IN_PROGRESS') {
    return (
      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs gap-1">
        <CircleDot className="h-3 w-3" />
        <span>Dikerjakan</span>
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="bg-muted text-muted-foreground text-xs gap-1">
      <Clock className="h-3 w-3" />
      <span>Belum Dikerjakan</span>
    </Badge>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  switch (priority) {
    case 'HIGH':
      return (
        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs font-medium">
          Tinggi
        </Badge>
      );
    case 'MEDIUM':
      return (
        <Badge variant="outline" className="bg-warning text-warning-foreground border-transparent text-xs font-medium">
          Sedang
        </Badge>
      );
    case 'LOW':
      return (
        <Badge variant="outline" className="bg-muted text-muted-foreground text-xs">
          Rendah
        </Badge>
      );
    default:
      return <Badge variant="outline" className="text-xs">{priority}</Badge>;
  }
}

function AdminAssignmentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialSearch = searchParams.get('search') || '';
  const initialStatus = (['TODO', 'IN_PROGRESS', 'DONE'].includes(searchParams.get('status') || '')
    ? searchParams.get('status')
    : '') as any;
  const initialPriority = (['LOW', 'MEDIUM', 'HIGH'].includes(searchParams.get('priority') || '')
    ? searchParams.get('priority')
    : '') as any;
  const initialPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const initialLimit = [10, 20, 50].includes(Number(searchParams.get('limit')))
    ? Number(searchParams.get('limit'))
    : 20;

  const [data, setData] = React.useState<AdminAssignmentListResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = React.useState(initialSearch);
  const [status, setStatus] = React.useState<string>(initialStatus);
  const [priority, setPriority] = React.useState<string>(initialPriority);
  const [page, setPage] = React.useState(initialPage);
  const [limit, setLimit] = React.useState(initialLimit);
  const [sortBy, setSortBy] = React.useState<'createdAt' | 'dueDate' | 'title'>('createdAt');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc');

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  React.useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (status) params.set('status', status);
    if (priority) params.set('priority', priority);
    if (page > 1) params.set('page', String(page));
    if (limit !== 20) params.set('limit', String(limit));
    if (sortBy !== 'createdAt') params.set('sortBy', sortBy);
    if (sortOrder !== 'desc') params.set('sortOrder', sortOrder);

    const queryString = params.toString();
    const target = queryString ? `/assignments?${queryString}` : '/assignments';
    router.replace(target, { scroll: false });
  }, [debouncedSearch, status, priority, page, limit, sortBy, sortOrder, router]);

  const loadData = React.useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchAdminAssignments(
        {
          search: debouncedSearch || undefined,
          status: (status as any) || undefined,
          priority: (priority as any) || undefined,
          page,
          limit,
          sortBy,
          sortOrder,
        },
        { signal }
      );
      setData(res);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Gagal memuat daftar tugas kuliah');
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, status, priority, page, limit, sortBy, sortOrder]);

  React.useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  const handleExportCsv = () => {
    if (!data || data.items.length === 0) return;
    const headers = [
      'ID',
      'Judul Tugas',
      'Mata Kuliah',
      'Batas Waktu',
      'Prioritas',
      'Status',
      'Terlewat',
      'Subtugas Selesai',
      'Total Subtugas',
      'Mahasiswa',
      'Email Mahasiswa',
      'Tanggal Dibuat',
    ];
    const rows = data.items.map((item) => [
      item.id,
      item.title,
      item.courseName,
      new Date(item.dueDate).toLocaleString('id-ID'),
      item.priority,
      item.status,
      item.isOverdue ? 'YA' : 'TIDAK',
      String(item.completedSubtasksCount),
      String(item.subtasksCount),
      item.userName,
      item.userEmail,
      new Date(item.createdAt).toLocaleString('id-ID'),
    ]);
    downloadCsvFile('data-tugas-kuliah-studyflow.csv', [headers, ...rows]);
  };

  const handleSort = (field: 'createdAt' | 'dueDate' | 'title') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder(field === 'dueDate' ? 'asc' : 'desc');
    }
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ListTodo className="h-6 w-6 text-primary" />
            Tugas Kuliah
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Daftar seluruh tugas, deadline, dan progres subtugas mahasiswa.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData()}
            disabled={isLoading}
            className="h-9 gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={isLoading || !data?.items.length}
            className="h-9 gap-1.5 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Ekspor CSV</span>
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="p-3.5 border-border bg-card shadow-xs">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Cari tugas, deskripsi, mata kuliah, mahasiswa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-8 text-xs h-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                aria-label="Hapus pencarian"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={status || 'ALL'}
              onValueChange={(val) => {
                setStatus(val === 'ALL' ? '' : val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-36 text-xs">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">Semua Status</SelectItem>
                <SelectItem value="TODO" className="text-xs">Belum Selesai</SelectItem>
                <SelectItem value="IN_PROGRESS" className="text-xs">Dikerjakan</SelectItem>
                <SelectItem value="DONE" className="text-xs">Selesai</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={priority || 'ALL'}
              onValueChange={(val) => {
                setPriority(val === 'ALL' ? '' : val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-32 text-xs">
                <SelectValue placeholder="Prioritas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">Semua Prioritas</SelectItem>
                <SelectItem value="HIGH" className="text-xs">Tinggi</SelectItem>
                <SelectItem value="MEDIUM" className="text-xs">Sedang</SelectItem>
                <SelectItem value="LOW" className="text-xs">Rendah</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={String(limit)}
              onValueChange={(val) => {
                setLimit(Number(val));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-28 text-xs">
                <SelectValue placeholder="Baris" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10" className="text-xs">10 per hal</SelectItem>
                <SelectItem value="20" className="text-xs">20 per hal</SelectItem>
                <SelectItem value="50" className="text-xs">50 per hal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-xs font-semibold">Gagal Mengambil Data</AlertTitle>
          <AlertDescription className="text-xs">
            {error}. Silakan klik tombol Segarkan untuk mencoba kembali.
          </AlertDescription>
        </Alert>
      )}

      {/* Loading Skeleton */}
      {isLoading && !data && <AssignmentsTableSkeleton />}

      {/* Data Table */}
      {(!isLoading || data) && (
        <FadeIn>
          <Card className="overflow-hidden border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border bg-muted/40">
                    <TableHead
                      className="cursor-pointer select-none text-xs font-semibold text-foreground"
                      onClick={() => handleSort('title')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Judul Tugas</span>
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-foreground">
                      Mata Kuliah
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-xs font-semibold text-foreground"
                      onClick={() => handleSort('dueDate')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Batas Waktu</span>
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-foreground">
                      Prioritas
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-foreground">
                      Status
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-foreground">
                      Subtugas
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-foreground">
                      Mahasiswa
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.items && data.items.length > 0 ? (
                    data.items.map((item: AdminAssignmentListItem) => (
                      <TableRow key={item.id} className="hover:bg-muted/30">
                        <TableCell className="py-3 text-xs font-semibold text-foreground">
                          {item.title}
                        </TableCell>
                        <TableCell className="py-3 text-xs font-medium text-foreground">
                          {item.courseName}
                        </TableCell>
                        <TableCell className="py-3 text-xs">
                          <p className="font-medium text-foreground tabular-nums">
                            {new Date(item.dueDate).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </TableCell>
                        <TableCell className="py-3 text-xs">
                          <PriorityBadge priority={item.priority} />
                        </TableCell>
                        <TableCell className="py-3 text-xs">
                          <StatusBadge status={item.status} isOverdue={item.isOverdue} />
                        </TableCell>
                        <TableCell className="py-3 text-xs">
                          {item.subtasksCount > 0 ? (
                            <span className="tabular-nums font-medium text-foreground">
                              {item.completedSubtasksCount} / {item.subtasksCount}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3 text-xs">
                          <Link
                            href={`/users/${item.userId}`}
                            className="font-medium text-primary hover:underline block"
                          >
                            {item.userName}
                          </Link>
                          <span className="text-muted-foreground">{item.userEmail}</span>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-xs">
                        <ListTodo className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                        <p className="font-medium text-foreground">Tidak ada tugas kuliah ditemukan</p>
                        <p className="mt-0.5">
                          {debouncedSearch || status || priority
                            ? 'Tidak ada tugas yang cocok dengan filter pencarian.'
                            : 'Belum ada tugas kuliah yang dibuat oleh mahasiswa.'}
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {data && data.pagination.totalPages > 1 && (
              <AdminPagination
                page={page}
                limit={limit}
                totalItems={data.pagination.totalItems}
                totalPages={data.pagination.totalPages}
                currentItemsCount={data.items.length}
                itemLabel="tugas kuliah"
                isLoading={isLoading}
                onPageChange={setPage}
              />
            )}
          </Card>
        </FadeIn>
      )}
    </div>
  );
}

export default function AdminAssignmentsPage(): React.JSX.Element {
  return (
    <React.Suspense fallback={<AssignmentsTableSkeleton />}>
      <AdminAssignmentsContent />
    </React.Suspense>
  );
}
