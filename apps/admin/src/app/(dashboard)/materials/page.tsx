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
  MoreHorizontal,
  Edit2,
  RotateCcw,
  Trash2,
  Loader2,
  CheckCircle2,
  FileText,
  Layers,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { FadeIn, StaggerGroup, StaggerItem } from '@/components/ui/motion';
import {
  fetchAdminMaterials,
  updateAdminMaterialApi,
  deleteAdminMaterialApi,
} from '@/lib/admin-api';
import type { AdminMaterialListItem, AdminMaterialListResponse, AdminMaterialStatus } from '@studyflow/shared';
import { AdminUpdateMaterialInputSchema } from '@studyflow/shared';
import { downloadCsvFile, formatBytes } from '@/lib/admin-formatters';
import { AdminPagination } from '@/components/admin-pagination';
import { toast } from 'sonner';

function MaterialsTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Skeleton className="h-10 w-full sm:max-w-sm" />
        <Skeleton className="h-9 w-32 self-end sm:self-auto" />
      </div>
      <Card className="hidden md:block overflow-hidden shadow-xs">
        <div className="p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Skeleton key={idx} className="h-10 w-full" />
          ))}
        </div>
      </Card>
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Skeleton key={idx} className="h-44 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status, safeErrorMessage }: { status: string; safeErrorMessage?: string | null }) {
  switch (status) {
    case 'READY':
      return (
        <Badge variant="outline" className="bg-success text-success-foreground border-transparent text-xs gap-1">
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
        <Badge variant="outline" className="bg-warning text-warning-foreground border-transparent text-xs gap-1">
          <Clock className="h-3 w-3" />
          <span>Dalam Antrean</span>
        </Badge>
      );
    case 'FAILED':
      return (
        <div className="space-y-1">
          <Badge variant="outline" className="bg-danger text-danger-foreground border-transparent text-xs gap-1">
            <AlertTriangle className="h-3 w-3" />
            <span>Gagal Ekstraksi</span>
          </Badge>
          {safeErrorMessage && (
            <p className="text-xs font-medium text-destructive max-w-xs truncate" title={safeErrorMessage}>
              {safeErrorMessage}
            </p>
          )}
        </div>
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

  // Dialog states for Edit Title & Delete
  const [editingMaterial, setEditingMaterial] = React.useState<AdminMaterialListItem | null>(null);
  const [editTitle, setEditTitle] = React.useState('');
  const [isEditSubmitting, setIsEditSubmitting] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);

  const [deletingMaterial, setDeletingMaterial] = React.useState<AdminMaterialListItem | null>(null);
  const [isDeleteSubmitting, setIsDeleteSubmitting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

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
          status: (status as AdminMaterialStatus) || undefined,
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

  // Metric counts derived from current items or summary
  const metrics = React.useMemo(() => {
    const totalItems = data?.pagination.totalItems ?? 0;
    const items = data?.items ?? [];
    const readyCount = items.filter((i) => i.status === 'READY').length;
    const processingCount = items.filter((i) => i.status === 'PROCESSING' || i.status === 'QUEUED').length;
    const failedCount = items.filter((i) => i.status === 'FAILED').length;
    return { totalItems, readyCount, processingCount, failedCount };
  }, [data]);

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
    toast.success('Daftar materi PDF berhasil diekspor ke CSV');
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

  // Open Edit Title modal
  const openEditTitleModal = (item: AdminMaterialListItem) => {
    setEditingMaterial(item);
    setEditTitle(item.title);
    setEditError(null);
  };

  // Submit Edit Title
  const handleEditTitleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMaterial) return;
    setEditError(null);

    const validationResult = AdminUpdateMaterialInputSchema.safeParse({ title: editTitle });
    if (!validationResult.success) {
      setEditError(validationResult.error.issues[0]?.message || 'Judul materi tidak valid');
      return;
    }

    setIsEditSubmitting(true);
    try {
      await updateAdminMaterialApi(editingMaterial.id, validationResult.data);
      toast.success('Judul materi berhasil diperbarui');
      setEditingMaterial(null);
      loadData();
    } catch (err: any) {
      setEditError(err.message || 'Gagal memperbarui judul materi');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  // Retry Extraction
  const handleRetryExtraction = async (item: AdminMaterialListItem) => {
    try {
      await updateAdminMaterialApi(item.id, { action: 'retry' });
      toast.success(`Ekstraksi untuk "${item.title}" dijadwalkan ulang`);
      loadData();
    } catch (err: any) {
      toast.error('Gagal menjadwalkan ulang ekstraksi: ' + err.message);
    }
  };

  // Submit Delete Material
  const handleDeleteSubmit = async () => {
    if (!deletingMaterial) return;
    setIsDeleteSubmitting(true);
    setDeleteError(null);
    try {
      await deleteAdminMaterialApi(deletingMaterial.id);
      toast.success(`Materi "${deletingMaterial.title}" berhasil dihapus dan kuota dikembalikan`);
      setDeletingMaterial(null);
      loadData();
    } catch (err: any) {
      setDeleteError(err.message || 'Gagal menghapus materi');
    } finally {
      setIsDeleteSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full p-4 md:p-8">
      {/* Cockpit Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2 md:text-3xl">
            <Files className="h-7 w-7 text-primary" />
            Manajemen Materi PDF
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Daftar seluruh berkas pembelajaran PDF yang diunggah mahasiswa, pemantauan status ekstraksi, dan tindakan moderasi.
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

      {/* 4 Summary Metric Cards */}
      <StaggerGroup className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Materi */}
        <StaggerItem>
          <Card className="border-border bg-card shadow-xs p-4">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Total Materi Terdaftar</span>
              <Files className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">
              {metrics.totalItems.toLocaleString('id-ID')}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Dokumen PDF aktif</p>
          </Card>
        </StaggerItem>

        {/* READY */}
        <StaggerItem>
          <Card className="border-border bg-card shadow-xs p-4">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Siap Dipakai (Ready)</span>
              <CheckCircle2 className="h-4 w-4 text-success-foreground" />
            </div>
            <p className="text-2xl font-bold text-success-foreground mt-1 tabular-nums">
              {metrics.readyCount.toLocaleString('id-ID')}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Teks berhasil diekstrak</p>
          </Card>
        </StaggerItem>

        {/* PROCESSING / QUEUED */}
        <StaggerItem>
          <Card className="border-border bg-card shadow-xs p-4">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Sedang Diproses</span>
              <Clock className="h-4 w-4 text-warning-foreground" />
            </div>
            <p className="text-2xl font-bold text-warning-foreground mt-1 tabular-nums">
              {metrics.processingCount.toLocaleString('id-ID')}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Dalam antrean worker</p>
          </Card>
        </StaggerItem>

        {/* FAILED */}
        <StaggerItem>
          <Card className={`border-border bg-card shadow-xs p-4 ${metrics.failedCount > 0 ? 'border-destructive/40' : ''}`}>
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Gagal Ekstraksi</span>
              <AlertTriangle className={`h-4 w-4 ${metrics.failedCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            </div>
            <p className={`text-2xl font-bold mt-1 tabular-nums ${metrics.failedCount > 0 ? 'text-destructive' : 'text-foreground'}`}>
              {metrics.failedCount.toLocaleString('id-ID')}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {metrics.failedCount > 0 ? 'Perlu tindakan coba ulang' : 'Tidak ada berkas gagal'}
            </p>
          </Card>
        </StaggerItem>
      </StaggerGroup>

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

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={status || 'ALL'}
              onValueChange={(val) => {
                setStatus(val === 'ALL' ? '' : val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-38 text-xs">
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
          <AlertDescription className="text-xs flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => loadData()} className="h-7 text-xs">
              Coba Lagi
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Loading Skeleton */}
      {isLoading && !data && <MaterialsTableSkeleton />}

      {/* Data Table */}
      {(!isLoading || data) && (
        <FadeIn>
          {/* Desktop Table (>= 768px) */}
          <Card className="hidden md:block overflow-hidden border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border bg-muted/40">
                    <TableHead
                      className="cursor-pointer select-none text-xs font-semibold text-foreground"
                      onClick={() => handleSort('title')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Judul Materi &amp; Berkas</span>
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
                        <span>Ukuran &amp; Halaman</span>
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
                    <TableHead className="text-right text-xs font-semibold text-foreground w-16">
                      Aksi
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
                          <span className="text-muted-foreground font-mono">{item.userEmail}</span>
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
                          <StatusBadge status={item.status} safeErrorMessage={item.safeErrorMessage} />
                        </TableCell>
                        <TableCell className="py-3 text-xs text-right text-muted-foreground tabular-nums whitespace-nowrap">
                          {new Date(item.createdAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 p-0" aria-label={`Aksi untuk materi ${item.title}`}>
                                <span className="sr-only">Buka menu aksi</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem
                                onClick={() => openEditTitleModal(item)}
                                className="cursor-pointer text-xs"
                              >
                                <Edit2 className="mr-2 h-4 w-4 text-primary" />
                                <span>Ubah Judul</span>
                              </DropdownMenuItem>

                              {item.status === 'FAILED' && (
                                <DropdownMenuItem
                                  onClick={() => handleRetryExtraction(item)}
                                  className="cursor-pointer text-xs"
                                >
                                  <RotateCcw className="mr-2 h-4 w-4 text-warning-foreground" />
                                  <span>Coba Ulang Ekstraksi</span>
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuSeparator />

                              <DropdownMenuItem
                                onClick={() => setDeletingMaterial(item)}
                                className="cursor-pointer text-xs text-destructive focus:bg-destructive/10 focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>Hapus Berkas</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-xs">
                        <Files className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                        <p className="font-medium text-foreground text-sm">Tidak ada berkas materi ditemukan</p>
                        <p className="mt-1 text-xs">
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
          </Card>

          {/* Mobile Cards View (< 768px) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {data?.items && data.items.length > 0 ? (
              data.items.map((item: AdminMaterialListItem) => (
                <Card key={item.id} className="border-border bg-card shadow-xs p-4 flex flex-col justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-foreground break-words">{item.title}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate" title={item.originalFilename}>
                          {item.originalFilename}
                        </p>
                      </div>
                      <StatusBadge status={item.status} safeErrorMessage={item.safeErrorMessage} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/50">
                      <div>
                        <span className="text-muted-foreground block">Mata Kuliah</span>
                        <span className="font-medium text-foreground truncate block">{item.courseName}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Mahasiswa</span>
                        <Link
                          href={`/users/${item.userId}`}
                          className="font-medium text-primary hover:underline truncate block"
                        >
                          {item.userName}
                        </Link>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Ukuran / Hal.</span>
                        <span className="text-foreground tabular-nums">
                          {formatBytes(item.bytes)} • {item.pageCount ? `${item.pageCount} hal.` : '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Diupload</span>
                        <span className="text-foreground tabular-nums">
                          {new Date(item.createdAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Mobile Action Bar with accessible touch targets */}
                  <div className="flex items-center gap-2 border-t border-border/60 pt-2.5 mt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditTitleModal(item)}
                      className="flex-1 h-10 text-xs gap-1.5 font-medium"
                    >
                      <Edit2 className="h-3.5 w-3.5 text-primary" />
                      <span>Ubah Judul</span>
                    </Button>

                    {item.status === 'FAILED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRetryExtraction(item)}
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
                          aria-label={`Aksi untuk materi ${item.title}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={() => openEditTitleModal(item)}
                          className="cursor-pointer text-xs"
                        >
                          <Edit2 className="mr-2 h-4 w-4 text-primary" />
                          <span>Ubah Judul</span>
                        </DropdownMenuItem>

                        {item.status === 'FAILED' && (
                          <DropdownMenuItem
                            onClick={() => handleRetryExtraction(item)}
                            className="cursor-pointer text-xs"
                          >
                            <RotateCcw className="mr-2 h-4 w-4 text-warning-foreground" />
                            <span>Coba Ulang Ekstraksi</span>
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                          onClick={() => setDeletingMaterial(item)}
                          className="cursor-pointer text-xs text-destructive focus:bg-destructive/10 focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          <span>Hapus Berkas</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="p-8 text-center border-border bg-card shadow-xs">
                <Files className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="font-medium text-foreground text-sm">Tidak ada berkas materi ditemukan</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {debouncedSearch || status
                    ? 'Tidak ada berkas materi yang cocok dengan filter yang dipilih.'
                    : 'Belum ada berkas PDF yang diunggah mahasiswa.'}
                </p>
                {(debouncedSearch || status) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch('');
                      setStatus('');
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
        </FadeIn>
      )}

      {/* Modal 1: Ubah Judul Materi */}
      <Dialog open={Boolean(editingMaterial)} onOpenChange={(open) => !open && setEditingMaterial(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-primary" />
              Ubah Judul Materi PDF
            </DialogTitle>
            <DialogDescription>
              Perbarui judul dokumen pembelajaran agar lebih deskriptif dan mudah diidentifikasi.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditTitleSubmit} className="space-y-4 py-2">
            {editError && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{editError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="material-title" className="text-xs font-semibold">Judul Materi</Label>
              <Input
                id="material-title"
                required
                minLength={2}
                maxLength={200}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            {editingMaterial && (
              <div className="rounded-lg border border-border bg-muted/20 p-2.5 text-xs text-muted-foreground space-y-0.5">
                <p><strong>Nama Berkas:</strong> {editingMaterial.originalFilename}</p>
                <p><strong>Mata Kuliah:</strong> {editingMaterial.courseName}</p>
                <p><strong>Pengunggah:</strong> {editingMaterial.userName}</p>
              </div>
            )}

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingMaterial(null)}
                disabled={isEditSubmitting}
                className="h-9 text-xs"
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isEditSubmitting}
                className="h-9 text-xs gap-1.5"
              >
                {isEditSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Simpan Judul</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Konfirmasi Hapus Materi */}
      <Dialog open={Boolean(deletingMaterial)} onOpenChange={(open) => !open && setDeletingMaterial(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Hapus Berkas Materi
            </DialogTitle>
            <DialogDescription>
              Materi ini akan dihapus dari sistem, antrean pemrosesan aktif akan dibatalkan, dan kuota penyimpanan mahasiswa akan dikembalikan.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <Alert variant="destructive" className="py-2 my-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{deleteError}</AlertDescription>
            </Alert>
          )}

          {deletingMaterial && (
            <div className="rounded-lg border border-border bg-muted/20 p-3 my-2 text-xs space-y-1">
              <p><strong className="text-foreground">Judul:</strong> {deletingMaterial.title}</p>
              <p><strong className="text-foreground">Nama Berkas:</strong> {deletingMaterial.originalFilename}</p>
              <p><strong className="text-foreground">Ukuran:</strong> {formatBytes(deletingMaterial.bytes)}</p>
              <p><strong className="text-foreground">Pemilik:</strong> {deletingMaterial.userName} ({deletingMaterial.userEmail})</p>
            </div>
          )}

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeletingMaterial(null)}
              disabled={isDeleteSubmitting}
              className="h-9 text-xs"
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDeleteSubmit}
              disabled={isDeleteSubmitting}
              className="h-9 text-xs gap-1.5"
            >
              {isDeleteSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Konfirmasi Hapus</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
