'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Search,
  Files,
  RefreshCw,
  AlertCircle,
  X,
  ArrowUpDown,
  Download,
  FileCheck2,
  Clock,
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
import { fetchAdminMaterials } from '@/lib/admin-api';
import { AdminMaterialListItem, AdminMaterialListResponse } from '@studyflow/shared';
import { downloadCsvFile, formatBytes } from '@/lib/admin-formatters';
import { AdminPagination } from '@/components/admin-pagination';

function MaterialsTableSkeleton() {
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

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'READY':
      return (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs gap-1">
          <FileCheck2 className="h-3 w-3" />
          <span>Siap (Ready)</span>
        </Badge>
      );
    case 'PROCESSING':
      return (
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs gap-1 animate-pulse">
          <RefreshCw className="h-3 w-3 animate-spin" />
          <span>Memproses</span>
        </Badge>
      );
    case 'QUEUED':
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs gap-1">
          <Clock className="h-3 w-3" />
          <span>Dalam Antrean</span>
        </Badge>
      );
    case 'FAILED':
      return (
        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs gap-1">
          <AlertTriangle className="h-3 w-3" />
          <span>Gagal Ekstraksi</span>
        </Badge>
      );
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
}

function AdminMaterialsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialSearch = searchParams.get('search') || '';
  const initialStatus = searchParams.get('status') || '';
  const initialPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const initialLimit = [10, 20, 50].includes(Number(searchParams.get('limit')))
    ? Number(searchParams.get('limit'))
    : 20;

  const [data, setData] = React.useState<AdminMaterialListResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = React.useState(initialSearch);
  const [status, setStatus] = React.useState(initialStatus);
  const [page, setPage] = React.useState(initialPage);
  const [limit, setLimit] = React.useState(initialLimit);
  const [sortBy, setSortBy] = React.useState<'createdAt' | 'title' | 'bytes'>('createdAt');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc');

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Sync state to URL
  React.useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (status) params.set('status', status);
    if (page > 1) params.set('page', String(page));
    if (limit !== 20) params.set('limit', String(limit));
    if (sortBy !== 'createdAt') params.set('sortBy', sortBy);
    if (sortOrder !== 'desc') params.set('sortOrder', sortOrder);

    const queryString = params.toString();
    const target = queryString ? `/materials?${queryString}` : '/materials';
    router.replace(target, { scroll: false });
  }, [debouncedSearch, status, page, limit, sortBy, sortOrder, router]);

  const loadData = React.useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchAdminMaterials(
        {
          search: debouncedSearch || undefined,
          status: status || undefined,
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
      setError(err.message || 'Gagal memuat daftar berkas materi');
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, status, page, limit, sortBy, sortOrder]);

  React.useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  const handleExportCsv = () => {
    if (!data || data.items.length === 0) return;
    const headers = [
      'ID',
      'Judul Materi',
      'Nama Berkas',
      'Ukuran (Bytes)',
      'Halaman',
      'Status',
      'Mata Kuliah',
      'Mahasiswa',
      'Email Mahasiswa',
      'Tanggal Unggah',
    ];
    const rows = data.items.map((item) => [
      item.id,
      item.title,
      item.originalFilename,
      String(item.bytes),
      item.pageCount ? String(item.pageCount) : '-',
      item.status,
      item.courseName,
      item.userName,
      item.userEmail,
      new Date(item.createdAt).toLocaleString('id-ID'),
    ]);
    downloadCsvFile('data-materi-pdf-studyflow.csv', [headers, ...rows]);
  };

  const handleSort = (field: 'createdAt' | 'title' | 'bytes') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Files className="h-6 w-6 text-primary" />
            Materi Kuliah (Dokumen PDF)
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Daftar seluruh berkas materi pembelajaran PDF yang diunggah mahasiswa.
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
              placeholder="Cari judul materi, nama berkas, mata kuliah, mahasiswa..."
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

          <div className="flex items-center gap-2">
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
                <SelectItem value="READY" className="text-xs">Siap (Ready)</SelectItem>
                <SelectItem value="PROCESSING" className="text-xs">Memproses</SelectItem>
                <SelectItem value="QUEUED" className="text-xs">Dalam Antrean</SelectItem>
                <SelectItem value="FAILED" className="text-xs">Gagal Ekstraksi</SelectItem>
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
      {isLoading && !data && <MaterialsTableSkeleton />}

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
                        <span>Judul Materi & Berkas</span>
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-foreground">
                      Mata Kuliah
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-foreground">
                      Mahasiswa
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-xs font-semibold text-foreground"
                      onClick={() => handleSort('bytes')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Ukuran & Halaman</span>
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-foreground">
                      Status Ekstraksi
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-xs font-semibold text-foreground text-right"
                      onClick={() => handleSort('createdAt')}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>Diupload</span>
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.items && data.items.length > 0 ? (
                    data.items.map((item: AdminMaterialListItem) => (
                      <TableRow key={item.id} className="hover:bg-muted/30">
                        <TableCell className="py-3 text-xs">
                          <p className="font-semibold text-foreground text-xs">{item.title}</p>
                          <p className="text-muted-foreground font-mono text-xs truncate max-w-xs" title={item.originalFilename}>
                            {item.originalFilename}
                          </p>
                        </TableCell>
                        <TableCell className="py-3 text-xs font-medium text-foreground">
                          {item.courseName}
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
                        <TableCell className="py-3 text-xs">
                          <p className="font-medium text-foreground tabular-nums">
                            {formatBytes(item.bytes)}
                          </p>
                          <p className="text-muted-foreground tabular-nums">
                            {item.pageCount ? `${item.pageCount} halaman` : 'Halaman belum dihitung'}
                          </p>
                        </TableCell>
                        <TableCell className="py-3 text-xs">
                          <StatusBadge status={item.status} />
                        </TableCell>
                        <TableCell className="py-3 text-xs text-right text-muted-foreground tabular-nums">
                          {new Date(item.createdAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-xs">
                        <Files className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                        <p className="font-medium text-foreground">Tidak ada berkas materi ditemukan</p>
                        <p className="mt-0.5">
                          {debouncedSearch || status
                            ? 'Tidak ada berkas materi yang cocok dengan filter yang dipilih.'
                            : 'Belum ada berkas PDF yang diunggah mahasiswa.'}
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
                itemLabel="materi PDF"
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

export default function AdminMaterialsPage(): React.JSX.Element {
  return (
    <React.Suspense fallback={<MaterialsTableSkeleton />}>
      <AdminMaterialsContent />
    </React.Suspense>
  );
}
