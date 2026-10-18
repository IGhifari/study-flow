'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Search,
  Users,
  RefreshCw,
  AlertCircle,
  X,
  ArrowUpDown,
  MoreHorizontal,
  Copy,
  Check,
  Eye,
  Download,
  UserPlus,
  Edit2,
  Trash2,
  RotateCcw,
  LogOut,
  Shield,
  Clock,
  Loader2,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { FadeIn } from '@/components/ui/motion';
import {
  fetchAdminUsers,
  createAdminUserApi,
  updateAdminUserApi,
  deleteAdminUserApi,
} from '@/lib/admin-api';
import { useAdminAuth } from '@/components/admin-auth-context';
import type { AdminUserListItem, AdminUserListResponse, Role } from '@studyflow/shared';
import { downloadCsvFile } from '@/lib/admin-formatters';
import { AdminPagination } from '@/components/admin-pagination';
import { toast } from 'sonner';

function UsersTableSkeleton() {
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
          <Skeleton key={idx} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function AdminUsersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: currentAdmin } = useAdminAuth();

  // Initialize from searchParams
  const initialSearch = searchParams.get('search') || '';
  const initialRole = searchParams.get('role') || 'ALL';
  const initialVerified = searchParams.get('verified') || 'ALL';
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
  const [roleFilter, setRoleFilter] = React.useState<string>(initialRole);
  const [verifiedFilter, setVerifiedFilter] = React.useState<string>(initialVerified);
  const [page, setPage] = React.useState(initialPage);
  const [limit, setLimit] = React.useState(initialLimit);
  const [sortBy, setSortBy] = React.useState<'createdAt' | 'name' | 'email'>(initialSortBy);
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>(initialSortOrder);

  // Copy feedback state
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [isExporting, setIsExporting] = React.useState(false);

  // CRUD Dialog states
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isCreateSubmitting, setIsCreateSubmitting] = React.useState(false);
  const [createForm, setCreateForm] = React.useState({
    name: '',
    email: '',
    password: '',
    role: 'USER' as Role,
    timezone: 'Asia/Jakarta',
    emailVerified: true,
  });
  const [createError, setCreateError] = React.useState<string | null>(null);

  const [editingUser, setEditingUser] = React.useState<AdminUserListItem | null>(null);
  const [isEditSubmitting, setIsEditSubmitting] = React.useState(false);
  const [editForm, setEditForm] = React.useState({
    name: '',
    email: '',
    role: 'USER' as Role,
    timezone: 'Asia/Jakarta',
    emailVerified: true,
  });
  const [editError, setEditError] = React.useState<string | null>(null);

  const [deletingUser, setDeletingUser] = React.useState<AdminUserListItem | null>(null);
  const [isDeleteSubmitting, setIsDeleteSubmitting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  // Open create modal if URL contains ?create=true
  React.useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setIsCreateOpen(true);
    }
  }, [searchParams]);

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
    if (roleFilter !== 'ALL') params.set('role', roleFilter);
    if (verifiedFilter !== 'ALL') params.set('verified', verifiedFilter);
    if (sortBy !== 'createdAt') params.set('sortBy', sortBy);
    if (sortOrder !== 'desc') params.set('sortOrder', sortOrder);

    const queryString = params.toString();
    const targetUrl = queryString ? `/users?${queryString}` : '/users';
    window.history.replaceState(null, '', targetUrl);
  }, [page, limit, debouncedSearch, roleFilter, verifiedFilter, sortBy, sortOrder]);

  const currentQueryString = React.useMemo(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set('page', String(page));
    if (limit !== 20) params.set('limit', String(limit));
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (roleFilter !== 'ALL') params.set('role', roleFilter);
    if (verifiedFilter !== 'ALL') params.set('verified', verifiedFilter);
    if (sortBy !== 'createdAt') params.set('sortBy', sortBy);
    if (sortOrder !== 'desc') params.set('sortOrder', sortOrder);
    return params.toString();
  }, [page, limit, debouncedSearch, roleFilter, verifiedFilter, sortBy, sortOrder]);

  const loadUsers = React.useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchAdminUsers(
        {
          page,
          limit,
          search: debouncedSearch || undefined,
          role: roleFilter !== 'ALL' ? (roleFilter as Role) : undefined,
          verified:
            verifiedFilter === 'true'
              ? 'true'
              : verifiedFilter === 'false'
                ? 'false'
                : undefined,
          sortBy,
          sortOrder,
        },
        { signal }
      );
      setData(res);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Gagal memuat daftar pengguna');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, debouncedSearch, roleFilter, verifiedFilter, sortBy, sortOrder]);

  React.useEffect(() => {
    const controller = new AbortController();
    loadUsers(controller.signal);
    return () => controller.abort();
  }, [loadUsers]);

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
          role: roleFilter !== 'ALL' ? (roleFilter as Role) : undefined,
          verified:
            verifiedFilter === 'true'
              ? 'true'
              : verifiedFilter === 'false'
                ? 'false'
                : undefined,
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

      const rows = allUsers.map((u) => [
        u.id,
        u.name,
        u.email,
        u.role,
        u.emailVerifiedAt ? 'Terverifikasi' : 'Belum Verifikasi',
        u.emailVerifiedAt ? new Date(u.emailVerifiedAt).toLocaleString('id-ID') : '-',
        new Date(u.createdAt).toLocaleString('id-ID'),
      ]);

      downloadCsvFile(
        `studyflow-pengguna-${new Date().toISOString().split('T')[0]}.csv`,
        [headers, ...rows]
      );
      toast.success('Daftar pengguna berhasil diekspor ke CSV');
    } catch (err: any) {
      toast.error('Gagal mengekspor data pengguna: ' + err.message);
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

  const toggleSort = (field: 'createdAt' | 'name' | 'email') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  // Create User Handler
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreateSubmitting(true);
    setCreateError(null);
    try {
      await createAdminUserApi(createForm);
      toast.success(`Pengguna ${createForm.name} berhasil dibuat`);
      setIsCreateOpen(false);
      setCreateForm({
        name: '',
        email: '',
        password: '',
        role: 'USER',
        timezone: 'Asia/Jakarta',
        emailVerified: true,
      });
      loadUsers();
    } catch (err: any) {
      setCreateError(err.message || 'Gagal membuat pengguna baru');
    } finally {
      setIsCreateSubmitting(false);
    }
  };

  // Open Edit User Dialog
  const openEditModal = (user: AdminUserListItem) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
      timezone: 'Asia/Jakarta',
      emailVerified: Boolean(user.emailVerifiedAt),
    });
    setEditError(null);
  };

  // Edit User Handler
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsEditSubmitting(true);
    setEditError(null);
    try {
      await updateAdminUserApi(editingUser.id, editForm);
      toast.success(`Data pengguna ${editForm.name} berhasil diperbarui`);
      setEditingUser(null);
      loadUsers();
    } catch (err: any) {
      setEditError(err.message || 'Gagal memperbarui pengguna');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  // Reset Quota Handler
  const handleResetQuota = async (user: AdminUserListItem) => {
    try {
      await updateAdminUserApi(user.id, { resetQuota: true });
      toast.success(`Kuota AI dan unggahan untuk ${user.name} berhasil direset ke batas harian penuh`);
      loadUsers();
    } catch (err: any) {
      toast.error('Gagal mereset kuota: ' + err.message);
    }
  };

  // Revoke Sessions Handler
  const handleRevokeSessions = async (user: AdminUserListItem) => {
    try {
      await updateAdminUserApi(user.id, { revokeSessions: true });
      toast.success(`Seluruh sesi login aktif untuk ${user.name} berhasil dicabut`);
      loadUsers();
    } catch (err: any) {
      toast.error('Gagal mencabut sesi login: ' + err.message);
    }
  };

  // Delete User Handler
  const handleDeleteSubmit = async () => {
    if (!deletingUser) return;
    setIsDeleteSubmitting(true);
    setDeleteError(null);
    try {
      await deleteAdminUserApi(deletingUser.id);
      toast.success(`Akun ${deletingUser.name} dan seluruh datanya berhasil dihapus`);
      setDeletingUser(null);
      loadUsers();
    } catch (err: any) {
      setDeleteError(err.message || 'Gagal menghapus akun pengguna');
    } finally {
      setIsDeleteSubmitting(false);
    }
  };

  const totalPages = data?.pagination.totalPages || 1;
  const totalItems = data?.pagination.totalItems || 0;

  return (
    <FadeIn className="flex flex-1 flex-col gap-6 p-4 md:p-8 max-w-7xl mx-auto w-full">
      {/* Top Cockpit Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl flex items-center gap-2">
            <Users className="h-7 w-7 text-primary" />
            Manajemen Pengguna
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kelola direktori mahasiswa, pengelola sistem (admin), reset kuota AI, serta mutasi akun secara aman.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <Button
            onClick={() => setIsCreateOpen(true)}
            size="sm"
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 h-9"
          >
            <UserPlus className="h-4 w-4" />
            Tambah Pengguna
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportUsersCsv}
            disabled={isExporting || isLoading}
            className="gap-2 h-9"
          >
            <Download className={`h-4 w-4 ${isExporting ? 'animate-bounce' : ''}`} />
            {isExporting ? 'Mengekspor...' : 'Ekspor CSV'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadUsers()}
            disabled={isLoading}
            className="gap-2 h-9"
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
              onClick={() => loadUsers()}
              className="bg-card text-foreground"
            >
              Coba Lagi
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Search and Filters Bar */}
      <Card className="p-3.5 border-border bg-card shadow-xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama atau email pengguna..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              maxLength={100}
              className="pl-9 pr-9 h-9 text-xs"
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

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Role */}
            <Select
              value={roleFilter}
              onValueChange={(val: string) => {
                setRoleFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-36 h-9 text-xs">
                <SelectValue placeholder="Semua Peran" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">Semua Peran</SelectItem>
                <SelectItem value="USER" className="text-xs">Mahasiswa (USER)</SelectItem>
                <SelectItem value="ADMIN" className="text-xs">Administrator</SelectItem>
              </SelectContent>
            </Select>

            {/* Filter Status Verifikasi */}
            <Select
              value={verifiedFilter}
              onValueChange={(val: string) => {
                setVerifiedFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-38 h-9 text-xs">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">Semua Verifikasi</SelectItem>
                <SelectItem value="true" className="text-xs">Terverifikasi</SelectItem>
                <SelectItem value="false" className="text-xs">Belum Verifikasi</SelectItem>
              </SelectContent>
            </Select>

            {/* Limit Selector */}
            <Select
              value={String(limit)}
              onValueChange={(val: string) => {
                setLimit(Number(val));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-24 h-9 text-xs tabular-nums">
                <SelectValue placeholder={String(limit)} />
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

      {/* Users Table */}
      {/* Desktop Table (>= 768px) */}
      <Card className="hidden md:block overflow-hidden shadow-xs border-border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 border-b border-border">
                <TableHead className="w-[280px]">
                  <button
                    type="button"
                    onClick={() => toggleSort('name')}
                    className="inline-flex items-center gap-1.5 font-semibold text-xs text-foreground hover:text-primary select-none"
                  >
                    Nama Pengguna
                    <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </TableHead>
                <TableHead className="min-w-[240px]">
                  <button
                    type="button"
                    onClick={() => toggleSort('email')}
                    className="inline-flex items-center gap-1.5 font-semibold text-xs text-foreground hover:text-primary select-none"
                  >
                    Email
                    <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </TableHead>
                <TableHead className="w-[120px] text-xs font-semibold text-foreground">Peran</TableHead>
                <TableHead className="w-[160px] text-xs font-semibold text-foreground">Status Verifikasi</TableHead>
                <TableHead className="w-[180px]">
                  <button
                    type="button"
                    onClick={() => toggleSort('createdAt')}
                    className="inline-flex items-center gap-1.5 font-semibold text-xs text-foreground hover:text-primary select-none"
                  >
                    Bergabung
                    <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </TableHead>
                <TableHead className="text-right w-[90px] text-xs font-semibold text-foreground">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 rounded-md ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : data && data.items.length > 0 ? (
                data.items.map((user: AdminUserListItem) => {
                  const detailHref = currentQueryString
                    ? `/users/${user.id}?${currentQueryString}`
                    : `/users/${user.id}`;
                  const isCurrentAdmin = currentAdmin?.id === user.id;

                  return (
                    <TableRow key={user.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium text-foreground py-3 text-xs">
                        <Link
                          href={detailHref}
                          className="hover:underline hover:text-primary transition-colors inline-block font-semibold"
                        >
                          {user.name}
                        </Link>
                        {isCurrentAdmin && (
                          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs bg-primary/10 text-primary font-semibold">
                            Akun Anda
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs py-3">
                        {user.email}
                      </TableCell>
                      <TableCell className="py-3">
                        {user.role === 'ADMIN' ? (
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-semibold text-xs gap-1">
                            <Shield className="h-3 w-3" />
                            ADMIN
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="font-normal text-xs">
                            USER
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        {user.emailVerifiedAt ? (
                          <Badge variant="outline" className="bg-success text-success-foreground border-transparent text-xs">
                            Terverifikasi
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-warning text-warning-foreground border-transparent text-xs">
                            Belum Verifikasi
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap tabular-nums py-3">
                        {new Date(user.createdAt).toLocaleDateString('id-ID', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="text-right py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 p-0" aria-label={`Aksi untuk pengguna ${user.name}`}>
                              <span className="sr-only">Buka menu aksi</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem asChild>
                              <Link href={detailHref} className="cursor-pointer text-xs">
                                <Eye className="mr-2 h-4 w-4" />
                                <span>Lihat detail</span>
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleCopy(user.email, `email-${user.id}`)}
                              className="cursor-pointer text-xs"
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

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              onClick={() => openEditModal(user)}
                              className="cursor-pointer text-xs"
                            >
                              <Edit2 className="mr-2 h-4 w-4 text-primary" />
                              <span>Edit Akun &amp; Peran</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => handleResetQuota(user)}
                              className="cursor-pointer text-xs"
                            >
                              <RotateCcw className="mr-2 h-4 w-4 text-warning-foreground" />
                              <span>Reset Kuota Harian</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => handleRevokeSessions(user)}
                              className="cursor-pointer text-xs"
                            >
                              <LogOut className="mr-2 h-4 w-4 text-warning-foreground" />
                              <span>Cabut Sesi Aktif</span>
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              onClick={() => setDeletingUser(user)}
                              disabled={isCurrentAdmin}
                              className="cursor-pointer text-xs text-destructive focus:bg-destructive/10 focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>{isCurrentAdmin ? 'Akun Sendiri (Terkunci)' : 'Hapus Pengguna'}</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-40 text-center py-10">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="h-8 w-8 text-muted-foreground/50" />
                      {debouncedSearch || roleFilter !== 'ALL' || verifiedFilter !== 'ALL' ? (
                        <>
                          <p className="text-sm font-medium text-foreground">
                            Hasil pencarian tidak ditemukan
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Tidak ada pengguna yang cocok dengan kriteria filter yang dipilih.
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-foreground">
                            Belum ada pengguna
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Belum ada akun pengguna yang terdaftar di platform StudyFlow.
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
      </Card>

      {/* Mobile Cards View (< 768px) */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-40 w-full rounded-xl" />
          ))
        ) : data && data.items.length > 0 ? (
          data.items.map((user: AdminUserListItem) => {
            const detailHref = currentQueryString
              ? `/users/${user.id}?${currentQueryString}`
              : `/users/${user.id}`;
            const isCurrentAdmin = currentAdmin?.id === user.id;

            return (
              <Card key={user.id} className="border-border bg-card shadow-xs p-4 flex flex-col justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={detailHref}
                        className="font-semibold text-sm text-foreground hover:underline hover:text-primary transition-colors block truncate"
                      >
                        {user.name}
                      </Link>
                      <p className="text-xs text-muted-foreground font-mono truncate" title={user.email}>
                        {user.email}
                      </p>
                    </div>
                    {user.role === 'ADMIN' ? (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-semibold text-xs gap-1 shrink-0">
                        <Shield className="h-3 w-3" />
                        ADMIN
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="font-normal text-xs shrink-0">
                        USER
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50">
                    {user.emailVerifiedAt ? (
                      <Badge variant="outline" className="bg-success text-success-foreground border-transparent text-xs">
                        Terverifikasi
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-warning text-warning-foreground border-transparent text-xs">
                        Belum Verifikasi
                      </Badge>
                    )}

                    {isCurrentAdmin && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs bg-primary/10 text-primary font-semibold">
                        Akun Anda
                      </span>
                    )}

                    <span className="text-xs text-muted-foreground ml-auto tabular-nums">
                      {new Date(user.createdAt).toLocaleDateString('id-ID', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                {/* Mobile Action Bar with min 40px touch-friendly targets */}
                <div className="flex items-center gap-2 border-t border-border/60 pt-2.5 mt-1">
                  <Link href={detailHref} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full h-10 text-xs gap-1.5 font-medium">
                      <Eye className="h-3.5 w-3.5" />
                      <span>Detail Akun</span>
                    </Button>
                  </Link>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 px-3.5 text-xs shrink-0 gap-1"
                        aria-label={`Aksi untuk pengguna ${user.name}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem asChild>
                        <Link href={detailHref} className="cursor-pointer text-xs">
                          <Eye className="mr-2 h-4 w-4" />
                          <span>Lihat detail</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleCopy(user.email, `email-${user.id}`)}
                        className="cursor-pointer text-xs"
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

                      <DropdownMenuSeparator />

                      <DropdownMenuItem
                        onClick={() => openEditModal(user)}
                        className="cursor-pointer text-xs"
                      >
                        <Edit2 className="mr-2 h-4 w-4 text-primary" />
                        <span>Edit Akun &amp; Peran</span>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => handleResetQuota(user)}
                        className="cursor-pointer text-xs"
                      >
                        <RotateCcw className="mr-2 h-4 w-4 text-warning-foreground" />
                        <span>Reset Kuota Harian</span>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => handleRevokeSessions(user)}
                        className="cursor-pointer text-xs"
                      >
                        <LogOut className="mr-2 h-4 w-4 text-warning-foreground" />
                        <span>Cabut Sesi Aktif</span>
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      <DropdownMenuItem
                        onClick={() => setDeletingUser(user)}
                        disabled={isCurrentAdmin}
                        className="cursor-pointer text-xs text-destructive focus:bg-destructive/10 focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>{isCurrentAdmin ? 'Akun Sendiri (Terkunci)' : 'Hapus Pengguna'}</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            );
          })
        ) : (
          <Card className="p-8 text-center border-border bg-card shadow-xs">
            <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="font-medium text-foreground text-sm">
              {debouncedSearch || roleFilter !== 'ALL' || verifiedFilter !== 'ALL'
                ? 'Hasil pencarian tidak ditemukan'
                : 'Belum ada pengguna'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {debouncedSearch || roleFilter !== 'ALL' || verifiedFilter !== 'ALL'
                ? 'Tidak ada pengguna yang cocok dengan kriteria filter yang dipilih.'
                : 'Belum ada akun pengguna yang terdaftar di platform StudyFlow.'}
            </p>
            {(debouncedSearch || roleFilter !== 'ALL' || verifiedFilter !== 'ALL') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setRoleFilter('ALL');
                  setVerifiedFilter('ALL');
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
        currentItemsCount={data?.items.length ?? 0}
        itemLabel="pengguna"
        isLoading={isLoading}
        onPageChange={setPage}
      />

      {/* Modal 1: Tambah Pengguna */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Tambah Pengguna Baru
            </DialogTitle>
            <DialogDescription>
              Buat akun mahasiswa atau administrator baru langsung ke basis data.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 py-2">
            {createError && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{createError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="create-name" className="text-xs font-semibold">Nama Lengkap</Label>
              <Input
                id="create-name"
                required
                placeholder="Contoh: Muhammad Budi"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-email" className="text-xs font-semibold">Alamat Email</Label>
              <Input
                id="create-email"
                type="email"
                required
                placeholder="budi@kampus.ac.id"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-password" className="text-xs font-semibold">Kata Sandi Awal</Label>
              <Input
                id="create-password"
                type="password"
                required
                minLength={8}
                placeholder="Minimal 8 karakter"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Peran Akses</Label>
                <Select
                  value={createForm.role}
                  onValueChange={(val: Role) => setCreateForm({ ...createForm, role: val })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER" className="text-xs">Mahasiswa (USER)</SelectItem>
                    <SelectItem value="ADMIN" className="text-xs">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Zona Waktu</Label>
                <Select
                  value={createForm.timezone}
                  onValueChange={(val) => setCreateForm({ ...createForm, timezone: val })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asia/Jakarta" className="text-xs">WIB (Asia/Jakarta)</SelectItem>
                    <SelectItem value="Asia/Makassar" className="text-xs">WITA (Asia/Makassar)</SelectItem>
                    <SelectItem value="Asia/Jayapura" className="text-xs">WIT (Asia/Jayapura)</SelectItem>
                    <SelectItem value="UTC" className="text-xs">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="create-verified"
                checked={createForm.emailVerified}
                onCheckedChange={(checked) =>
                  setCreateForm({ ...createForm, emailVerified: Boolean(checked) })
                }
              />
              <Label htmlFor="create-verified" className="text-xs cursor-pointer">
                Tandai email langsung terverifikasi
              </Label>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
                disabled={isCreateSubmitting}
                className="h-9 text-xs"
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isCreateSubmitting}
                className="h-9 text-xs gap-1.5"
              >
                {isCreateSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Simpan Pengguna</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Edit Akun & Peran */}
      <Dialog open={Boolean(editingUser)} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-primary" />
              Edit Akun Pengguna
            </DialogTitle>
            <DialogDescription>
              Ubah data profil, peran akses, dan status verifikasi akun.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 py-2">
            {editError && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{editError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="edit-name" className="text-xs font-semibold">Nama Lengkap</Label>
              <Input
                id="edit-name"
                required
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-email" className="text-xs font-semibold">Alamat Email</Label>
              <Input
                id="edit-email"
                type="email"
                required
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Peran Akses</Label>
                <Select
                  value={editForm.role}
                  onValueChange={(val: Role) => setEditForm({ ...editForm, role: val })}
                  disabled={editingUser?.id === currentAdmin?.id}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER" className="text-xs">Mahasiswa (USER)</SelectItem>
                    <SelectItem value="ADMIN" className="text-xs">Administrator</SelectItem>
                  </SelectContent>
                </Select>
                {editingUser?.id === currentAdmin?.id && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Peran akun sendiri tidak dapat diturunkan.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Zona Waktu</Label>
                <Select
                  value={editForm.timezone}
                  onValueChange={(val) => setEditForm({ ...editForm, timezone: val })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asia/Jakarta" className="text-xs">WIB (Asia/Jakarta)</SelectItem>
                    <SelectItem value="Asia/Makassar" className="text-xs">WITA (Asia/Makassar)</SelectItem>
                    <SelectItem value="Asia/Jayapura" className="text-xs">WIT (Asia/Jayapura)</SelectItem>
                    <SelectItem value="UTC" className="text-xs">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="edit-verified"
                checked={editForm.emailVerified}
                onCheckedChange={(checked) =>
                  setEditForm({ ...editForm, emailVerified: Boolean(checked) })
                }
              />
              <Label htmlFor="edit-verified" className="text-xs cursor-pointer">
                Email terverifikasi
              </Label>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingUser(null)}
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
                <span>Perbarui Data</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 3: Konfirmasi Hapus Pengguna */}
      <Dialog open={Boolean(deletingUser)} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Hapus Akun Pengguna
            </DialogTitle>
            <DialogDescription>
              Tindakan ini bersifat permanen. Seluruh data akademik, materi, tugas, dan catatan milik pengguna akan dibersihkan secara kaskade.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <Alert variant="destructive" className="py-2 my-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{deleteError}</AlertDescription>
            </Alert>
          )}

          {deletingUser && (
            <div className="rounded-lg border border-border bg-muted/20 p-3 my-2 text-xs space-y-1">
              <p><strong className="text-foreground">Nama:</strong> {deletingUser.name}</p>
              <p><strong className="text-foreground">Email:</strong> {deletingUser.email}</p>
              <p><strong className="text-foreground">Peran:</strong> {deletingUser.role}</p>
            </div>
          )}

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeletingUser(null)}
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
              disabled={isDeleteSubmitting || deletingUser?.id === currentAdmin?.id}
              className="h-9 text-xs gap-1.5"
            >
              {isDeleteSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Konfirmasi Hapus Akun</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FadeIn>
  );
}

export default function AdminUsersPage() {
  return (
    <React.Suspense fallback={<UsersTableSkeleton />}>
      <AdminUsersContent />
    </React.Suspense>
  );
}
