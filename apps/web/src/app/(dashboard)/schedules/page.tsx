'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Search,
  CalendarClock,
  RefreshCw,
  AlertCircle,
  X,
  ArrowUpDown,
  Download,
  MapPin,
  Clock,
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
import { fetchAdminSchedules } from '@/lib/admin-api';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { AdminScheduleListItem, AdminScheduleListResponse } from '@studyflow/shared';
import { downloadCsvFile } from '@/lib/admin-formatters';
import { AdminPagination } from '@/components/admin/admin-pagination';

const DAYS_MAP: Record<number, string> = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
  7: 'Minggu',
};

function SchedulesTableSkeleton() {
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

function AdminSchedulesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialSearch = searchParams.get('search') || '';
  const initialDay = [1, 2, 3, 4, 5, 6, 7].includes(Number(searchParams.get('dayOfWeek')))
    ? Number(searchParams.get('dayOfWeek'))
    : 0;
  const initialPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const initialLimit = [10, 20, 50].includes(Number(searchParams.get('limit')))
    ? Number(searchParams.get('limit'))
    : 20;

  const [data, setData] = React.useState<AdminScheduleListResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState(initialSearch);
  const [dayOfWeek, setDayOfWeek] = React.useState<number>(initialDay);
  const [page, setPage] = React.useState(initialPage);
  const [limit, setLimit] = React.useState(initialLimit);
  const [sortBy, setSortBy] = React.useState<'dayOfWeek' | 'startTime' | 'createdAt'>('dayOfWeek');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('asc');
  const debouncedSearch = useDebouncedValue(search, 300, () => setPage(1));

  React.useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (dayOfWeek > 0) params.set('dayOfWeek', String(dayOfWeek));
    if (page > 1) params.set('page', String(page));
    if (limit !== 20) params.set('limit', String(limit));
    if (sortBy !== 'dayOfWeek') params.set('sortBy', sortBy);
    if (sortOrder !== 'asc') params.set('sortOrder', sortOrder);

    const queryString = params.toString();
    const target = queryString ? `/schedules?${queryString}` : '/schedules';
    router.replace(target, { scroll: false });
  }, [debouncedSearch, dayOfWeek, page, limit, sortBy, sortOrder, router]);

  const loadData = React.useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchAdminSchedules(
        {
          search: debouncedSearch || undefined,
          dayOfWeek: dayOfWeek > 0 ? dayOfWeek : undefined,
          page,
          limit,
          sortBy,
          sortOrder,
        },
        { signal }
      );
      setData(res);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Gagal memuat jadwal kuliah');
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, dayOfWeek, page, limit, sortBy, sortOrder]);

  React.useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  const handleExportCsv = () => {
    if (!data || data.items.length === 0) return;
    const headers = [
      'ID',
      'Hari',
      'Jam Mulai',
      'Jam Selesai',
      'Mata Kuliah',
      'Kode MK',
      'Ruangan',
      'Mahasiswa',
      'Email Mahasiswa',
    ];
    const rows = data.items.map((item) => [
      item.id,
      DAYS_MAP[item.dayOfWeek] || String(item.dayOfWeek),
      item.startTime,
      item.endTime,
      item.courseName,
      item.courseCode || '-',
      item.room || '-',
      item.userName,
      item.userEmail,
    ]);
    downloadCsvFile('data-jadwal-kuliah-studyflow.csv', [headers, ...rows]);
  };

  const handleSort = (field: 'dayOfWeek' | 'startTime' | 'createdAt') => {
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
            <CalendarClock className="h-6 w-6 text-primary" />
            Jadwal Perkuliahan
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Daftar seluruh jadwal sesi kelas perkuliahan mingguan mahasiswa.
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
              placeholder="Cari mata kuliah, kode, ruangan, mahasiswa..."
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
              value={String(dayOfWeek)}
              onValueChange={(val) => {
                setDayOfWeek(Number(val));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-32 text-xs">
                <SelectValue placeholder="Semua Hari" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0" className="text-xs">Semua Hari</SelectItem>
                <SelectItem value="1" className="text-xs">Senin</SelectItem>
                <SelectItem value="2" className="text-xs">Selasa</SelectItem>
                <SelectItem value="3" className="text-xs">Rabu</SelectItem>
                <SelectItem value="4" className="text-xs">Kamis</SelectItem>
                <SelectItem value="5" className="text-xs">Jumat</SelectItem>
                <SelectItem value="6" className="text-xs">Sabtu</SelectItem>
                <SelectItem value="7" className="text-xs">Minggu</SelectItem>
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
      {isLoading && !data && <SchedulesTableSkeleton />}

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
                      onClick={() => handleSort('dayOfWeek')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Hari</span>
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-xs font-semibold text-foreground"
                      onClick={() => handleSort('startTime')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Waktu Kelas</span>
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-foreground">
                      Mata Kuliah
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-foreground">
                      Ruangan
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-foreground">
                      Mahasiswa
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.items && data.items.length > 0 ? (
                    data.items.map((item: AdminScheduleListItem) => (
                      <TableRow key={item.id} className="hover:bg-muted/30">
                        <TableCell className="py-3 text-xs font-semibold text-foreground">
                          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs">
                            {DAYS_MAP[item.dayOfWeek] || item.dayOfWeek}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 text-xs">
                          <div className="flex items-center gap-1 text-foreground font-mono tabular-nums font-medium">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{item.startTime} - {item.endTime}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-xs">
                          <p className="font-semibold text-foreground">{item.courseName}</p>
                          {item.courseCode && (
                            <p className="font-mono text-muted-foreground">{item.courseCode}</p>
                          )}
                        </TableCell>
                        <TableCell className="py-3 text-xs">
                          {item.room ? (
                            <span className="inline-flex items-center gap-1 text-foreground text-xs font-medium">
                              <MapPin className="h-3.5 w-3.5 text-rose-500" />
                              <span>{item.room}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
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
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground text-xs">
                        <CalendarClock className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                        <p className="font-medium text-foreground">Tidak ada jadwal kuliah ditemukan</p>
                        <p className="mt-0.5">
                          {debouncedSearch || dayOfWeek > 0
                            ? 'Tidak ada jadwal yang cocok dengan filter pencarian.'
                            : 'Belum ada jadwal kuliah yang ditambahkan mahasiswa.'}
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
                itemLabel="jadwal perkuliahan"
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

export default function AdminSchedulesPage(): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <React.Suspense fallback={<SchedulesTableSkeleton />}>
        <AdminSchedulesContent />
      </React.Suspense>
    </div>
  );
}
