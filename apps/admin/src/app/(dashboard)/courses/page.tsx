'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Search,
  BookOpen,
  RefreshCw,
  AlertCircle,
  X,
  ArrowUpDown,
  Download,
  Files,
  ListTodo,
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
import { fetchAdminCourses } from '@/lib/admin-api';
import { AdminCourseListItem, AdminCourseListResponse } from '@studyflow/shared';
import { downloadCsvFile } from '@/lib/admin-formatters';
import { AdminPagination } from '@/components/admin-pagination';

function CoursesTableSkeleton() {
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

function AdminCoursesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialSearch = searchParams.get('search') || '';
  const initialPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const initialLimit = [10, 20, 50].includes(Number(searchParams.get('limit')))
    ? Number(searchParams.get('limit'))
    : 20;

  const [data, setData] = React.useState<AdminCourseListResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = React.useState(initialSearch);
  const [page, setPage] = React.useState(initialPage);
  const [limit, setLimit] = React.useState(initialLimit);
  const [sortBy, setSortBy] = React.useState<'createdAt' | 'name' | 'code'>('createdAt');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc');

  // Debounce search input
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Sync state to URL query params
  React.useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (page > 1) params.set('page', String(page));
    if (limit !== 20) params.set('limit', String(limit));
    if (sortBy !== 'createdAt') params.set('sortBy', sortBy);
    if (sortOrder !== 'desc') params.set('sortOrder', sortOrder);

    const queryString = params.toString();
    const target = queryString ? `/courses?${queryString}` : '/courses';
    router.replace(target, { scroll: false });
  }, [debouncedSearch, page, limit, sortBy, sortOrder, router]);

  const loadData = React.useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchAdminCourses(
        {
          search: debouncedSearch || undefined,
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
      setError(err.message || 'Gagal memuat daftar mata kuliah');
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, page, limit, sortBy, sortOrder]);

  React.useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  const handleExportCsv = () => {
    if (!data || data.items.length === 0) return;
    const headers = [
      'ID',
      'Nama Mata Kuliah',
      'Kode',
      'Dosen',
      'Semester',
      'Tahun Akademik',
      'Mahasiswa',
      'Email Mahasiswa',
      'Total Materi',
      'Total Tugas',
      'Tanggal Dibuat',
    ];
    const rows = data.items.map((item) => [
      item.id,
      item.name,
      item.code || '-',
      item.lecturer || '-',
      item.semesterName,
      item.academicYear,
      item.userName,
      item.userEmail,
      String(item.materialsCount),
      String(item.assignmentsCount),
      new Date(item.createdAt).toLocaleString('id-ID'),
    ]);
    downloadCsvFile('data-mata-kuliah-studyflow.csv', [headers, ...rows]);
  };

  const handleSort = (field: 'createdAt' | 'name' | 'code') => {
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
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Mata Kuliah
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Daftar seluruh mata kuliah yang didaftarkan mahasiswa di seluruh semester.
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

      {/* Filter & Search Bar */}
      <Card className="p-3.5 border-border bg-card shadow-xs">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Cari mata kuliah, kode, dosen, nama mahasiswa..."
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
      {isLoading && !data && <CoursesTableSkeleton />}

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
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Mata Kuliah</span>
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-xs font-semibold text-foreground"
                      onClick={() => handleSort('code')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Kode</span>
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-foreground">
                      Dosen
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-foreground">
                      Semester
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-foreground">
                      Mahasiswa
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-foreground text-center">
                      Statistik
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-xs font-semibold text-foreground text-right"
                      onClick={() => handleSort('createdAt')}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>Terdaftar</span>
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.items && data.items.length > 0 ? (
                    data.items.map((course: AdminCourseListItem) => (
                      <TableRow key={course.id} className="hover:bg-muted/30">
                        <TableCell className="py-3 font-medium text-xs text-foreground">
                          {course.name}
                        </TableCell>
                        <TableCell className="py-3 text-xs">
                          {course.code ? (
                            <Badge variant="outline" className="font-mono text-xs">
                              {course.code}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3 text-xs text-muted-foreground">
                          {course.lecturer || '-'}
                        </TableCell>
                        <TableCell className="py-3 text-xs">
                          <p className="font-medium text-foreground">{course.semesterName}</p>
                          <p className="text-muted-foreground">{course.academicYear}</p>
                        </TableCell>
                        <TableCell className="py-3 text-xs">
                          <Link
                            href={`/users/${course.userId}`}
                            className="font-medium text-primary hover:underline block"
                          >
                            {course.userName}
                          </Link>
                          <span className="text-muted-foreground">{course.userEmail}</span>
                        </TableCell>
                        <TableCell className="py-3 text-xs text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="inline-flex items-center gap-1 text-muted-foreground" title="Materi">
                              <Files className="h-3.5 w-3.5 text-primary" />
                              <span className="tabular-nums font-medium">{course.materialsCount}</span>
                            </span>
                            <span className="inline-flex items-center gap-1 text-muted-foreground" title="Tugas">
                              <ListTodo className="h-3.5 w-3.5 text-amber-500" />
                              <span className="tabular-nums font-medium">{course.assignmentsCount}</span>
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-xs text-right text-muted-foreground tabular-nums">
                          {new Date(course.createdAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-xs">
                        <BookOpen className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                        <p className="font-medium text-foreground">Tidak ada mata kuliah ditemukan</p>
                        <p className="mt-0.5">
                          {debouncedSearch
                            ? `Tidak ada mata kuliah yang cocok dengan kata kunci "${debouncedSearch}"`
                            : 'Belum ada data mata kuliah yang tersimpan di sistem.'}
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
                itemLabel="mata kuliah"
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

export default function AdminCoursesPage(): React.JSX.Element {
  return (
    <React.Suspense fallback={<CoursesTableSkeleton />}>
      <AdminCoursesContent />
    </React.Suspense>
  );
}
