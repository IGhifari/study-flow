'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Search,
  Users,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  X,
  ArrowUpDown,
  MoreHorizontal,
  Copy,
  Check,
  Eye,
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fetchAdminUsers } from '@/lib/admin-api';
import { AdminUserListItem, AdminUserListResponse } from '@studyflow/shared';

function UsersTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Skeleton className="h-10 w-full sm:max-w-sm" />
        <Skeleton className="h-9 w-32 self-end sm:self-auto" />
      </div>
      <div className="rounded-lg border border-border bg-card shadow-xs overflow-hidden">
        <div className="p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Skeleton key={idx} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminUsersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize from searchParams
  const initialSearch = searchParams.get('search') || '';
  const initialPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const initialLimit = [10, 20, 50].includes(Number(searchParams.get('limit')))
    ? Number(searchParams.get('limit'))
    : 20;
  const initialSortBy = (['createdAt', 'name', 'email'].includes(searchParams.get('sortBy') || '')
    ? searchParams.get('sortBy')
    : 'createdAt') as 'createdAt' | 'name' | 'email';
  const initialSortOrder = (['asc', 'desc'].includes(searchParams.get('sortOrder') || '')
    ? searchParams.get('sortOrder')
    : 'desc') as 'asc' | 'desc';

  const [data, setData] = React.useState<AdminUserListResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Filter & Pagination state
  const [search, setSearch] = React.useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = React.useState(initialSearch);
  const [page, setPage] = React.useState(initialPage);
  const [limit, setLimit] = React.useState(initialLimit);
  const [sortBy, setSortBy] = React.useState<'createdAt' | 'name' | 'email'>(initialSortBy);
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>(initialSortOrder);

  // Copy feedback state
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExportUsersCsv = async () => {
    try {
      setIsExporting(true);
      const allUsers: AdminUserListItem[] = [];
      let currentPage = 1;
      let hasMore = true;

      while (hasMore && allUsers.length < 1000) {
        const response = await fetchAdminUsers({
          page: currentPage,
          limit: 100,
          search: debouncedSearch || undefined,
          sortBy,
          sortOrder,
        });

        allUsers.push(...response.items);
        if (currentPage >= response.pagination.totalPages || response.items.length === 0) {
          hasMore = false;
        } else {
          currentPage += 1;
        }
      }

      const headers = [
        'ID Pengguna',
        'Nama Lengkap',
        'Email',
        'Peran',
        'Status Verifikasi',
        'Tanggal Verifikasi',
        'Tanggal Bergabung',
      ];

      const escapeCsv = (str: string | null | undefined) => {
        if (str === null || str === undefined) return '""';
        const escaped = String(str).replace(/"/g, '""');
        return `"${escaped}"`;
      };

      const rows = allUsers.map((u) => [
        escapeCsv(u.id),
        escapeCsv(u.name),
        escapeCsv(u.email),
        escapeCsv(u.role),
        escapeCsv(u.emailVerifiedAt ? 'Terverifikasi' : 'Belum Verifikasi'),
        escapeCsv(u.emailVerifiedAt ? new Date(u.emailVerifiedAt).toLocaleString('id-ID') : '-'),
        escapeCsv(new Date(u.createdAt).toLocaleString('id-ID')),
      ]);

      const csvContent =
        '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `studyflow-pengguna-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Failed to export users CSV:', err);
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

  // Debounce search input by 300ms
  React.useEffect(() => {
    const handler = setTimeout(() => {
      const trimmed = search.trim();
      setDebouncedSearch((prev) => {
        if (prev !== trimmed) {
          setPage(1);
        }
        return trimmed;
      });
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Sync URL search params
  React.useEffect(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set('page', String(page));
    if (limit !== 20) params.set('limit', String(limit));
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (sortBy !== 'createdAt') params.set('sortBy', sortBy);
    if (sortOrder !== 'desc') params.set('sortOrder', sortOrder);

    const queryString = params.toString();
    const targetUrl = queryString ? `/users?${queryString}` : '/users';
    window.history.replaceState(null, '', targetUrl);
  }, [page, limit, debouncedSearch, sortBy, sortOrder]);

  // Current query string to pass to detail link for preserving back context
  const currentQueryString = React.useMemo(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set('page', String(page));
    if (limit !== 20) params.set('limit', String(limit));
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (sortBy !== 'createdAt') params.set('sortBy', sortBy);
    if (sortOrder !== 'desc') params.set('sortOrder', sortOrder);
    return params.toString();
  }, [page, limit, debouncedSearch, sortBy, sortOrder]);

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
            onClick={handleExportUsersCsv}
            disabled={isExporting || isLoading}
            className="gap-2"
          >
            <Download className={`h-4 w-4 ${isExporting ? 'animate-bounce' : ''}`} />
            {isExporting ? 'Mengekspor...' : 'Ekspor CSV'}
          </Button>
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
                <TableHead className="text-right w-[90px]">Aksi</TableHead>
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
                    <TableCell className="text-right">
                      <Skeleton className="h-8 w-8 rounded-md ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : data && data.items.length > 0 ? (
                data.items.map((user: AdminUserListItem) => {
                  const detailHref = currentQueryString
                    ? `/users/${user.id}?${currentQueryString}`
                    : `/users/${user.id}`;

                  return (
                    <TableRow key={user.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium text-foreground">
                        <Link
                          href={detailHref}
                          className="hover:underline hover:text-primary transition-colors inline-block"
                        >
                          {user.name}
                        </Link>
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
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                              <span className="sr-only">Buka menu aksi</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem asChild>
                              <Link href={detailHref} className="cursor-pointer">
                                <Eye className="mr-2 h-4 w-4" />
                                <span>Lihat detail</span>
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleCopy(user.email, `email-${user.id}`)}
                              className="cursor-pointer"
                            >
                              {copiedKey === `email-${user.id}` ? (
                                <Check className="mr-2 h-4 w-4 text-emerald-500" />
                              ) : (
                                <Copy className="mr-2 h-4 w-4" />
                              )}
                              <span>
                                {copiedKey === `email-${user.id}` ? 'Email disalin' : 'Salin Email'}
                              </span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleCopy(user.id, `id-${user.id}`)}
                              className="cursor-pointer"
                            >
                              {copiedKey === `id-${user.id}` ? (
                                <Check className="mr-2 h-4 w-4 text-emerald-500" />
                              ) : (
                                <Copy className="mr-2 h-4 w-4" />
                              )}
                              <span>
                                {copiedKey === `id-${user.id}` ? 'ID disalin' : 'Salin User ID'}
                              </span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-40 text-center">
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

export default function AdminUsersPage() {
  return (
    <React.Suspense fallback={<UsersTableSkeleton />}>
      <AdminUsersContent />
    </React.Suspense>
  );
}
