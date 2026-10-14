'use client';

import * as React from 'react';
import {
  Search,
  Users,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  X,
  ArrowUpDown,
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
import { fetchAdminUsers } from '@/lib/admin-api';
import { AdminUserListItem, AdminUserListResponse } from '@studyflow/shared';

export default function AdminUsersPage() {
  const [data, setData] = React.useState<AdminUserListResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Filter & Pagination state
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(20);
  const [sortBy, setSortBy] = React.useState<'createdAt' | 'name' | 'email'>('createdAt');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc');

  // Debounce search input by 300ms
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1); // Reset to page 1 on new search
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Fetch users when parameters change, ignoring stale responses
  React.useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setError(null);

    fetchAdminUsers({
      page,
      limit,
      search: debouncedSearch || undefined,
      sortBy,
      sortOrder,
    })
      .then((res) => {
        if (!isCancelled) {
          setData(res);
        }
      })
      .catch((err: any) => {
        if (!isCancelled) {
          setError(err.message || 'Gagal memuat daftar pengguna');
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [page, limit, debouncedSearch, sortBy, sortOrder]);

  const toggleSort = (field: 'createdAt' | 'name' | 'email') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const handleRetry = () => {
    setIsLoading(true);
    setError(null);
    fetchAdminUsers({
      page,
      limit,
      search: debouncedSearch || undefined,
      sortBy,
      sortOrder,
    })
      .then((res) => setData(res))
      .catch((err: any) => setError(err.message || 'Gagal memuat daftar pengguna'))
      .finally(() => setIsLoading(false));
  };

  const totalPages = data?.pagination.totalPages || 1;
  const totalItems = data?.pagination.totalItems || 0;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Daftar Pengguna
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Lihat daftar akun mahasiswa dan administrator yang terdaftar pada StudyFlow.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Segarkan
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Terjadi Kesalahan</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              className="bg-card text-foreground"
            >
              Coba Lagi
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Search and Limit Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama atau email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={100}
            className="pl-9 pr-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Bersihkan pencarian"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto text-sm text-muted-foreground">
          <span>Tampilkan:</span>
          <Select
            value={String(limit)}
            onValueChange={(val: string) => {
              setLimit(Number(val));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-20 h-9">
              <SelectValue placeholder={String(limit)} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <span>baris</span>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-lg border border-border bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-[280px]">
                  <button
                    type="button"
                    onClick={() => toggleSort('name')}
                    className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-primary"
                  >
                    Nama
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </TableHead>
                <TableHead className="min-w-[240px]">
                  <button
                    type="button"
                    onClick={() => toggleSort('email')}
                    className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-primary"
                  >
                    Email
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </TableHead>
                <TableHead className="w-[120px]">Peran</TableHead>
                <TableHead className="w-[160px]">Status Verifikasi</TableHead>
                <TableHead className="w-[180px]">
                  <button
                    type="button"
                    onClick={() => toggleSort('createdAt')}
                    className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-primary"
                  >
                    Bergabung
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Skeleton className="h-4 w-36" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-48" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-24 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                  </TableRow>
                ))
              ) : data && data.items.length > 0 ? (
                data.items.map((user: AdminUserListItem) => (
                  <TableRow key={user.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium text-foreground">
                      {user.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      {user.role === 'ADMIN' ? (
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-semibold">
                          ADMIN
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="font-normal">
                          USER
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.emailVerifiedAt ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 text-xs">
                          Terverifikasi
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800 text-xs">
                          Belum Verifikasi
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {new Date(user.createdAt).toLocaleDateString('id-ID', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="h-8 w-8 text-muted-foreground/50" />
                      {debouncedSearch ? (
                        <>
                          <p className="text-sm font-medium text-foreground">
                            Hasil pencarian tidak ditemukan
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Tidak ada pengguna yang cocok dengan kata kunci &quot;{debouncedSearch}&quot;
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-foreground">
                            Belum ada pengguna
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Belum ada akun pengguna yang terdaftar di platform
                          </p>
                        </>
                      )}
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
              {data && data.items.length > 0 ? (page - 1) * limit + 1 : 0}
            </span>{' '}
            hingga{' '}
            <span className="font-semibold text-foreground">
              {data ? Math.min(page * limit, totalItems) : 0}
            </span>{' '}
            dari{' '}
            <span className="font-semibold text-foreground">
              {totalItems.toLocaleString('id-ID')}
            </span>{' '}
            pengguna
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
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
              disabled={page >= totalPages || isLoading}
              className="h-8 px-2.5 gap-1"
            >
              <span>Berikutnya</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
