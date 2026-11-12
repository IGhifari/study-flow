'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  Copy,
  Check,
  User,
  Mail,
  Shield,
  Calendar,
  Clock,
  KeyRound,
  GraduationCap,
  BookOpen,
  FileText,
  CheckSquare,
  StickyNote,
  HardDrive,
  Info,
  UserX,
  Edit2,
  Trash2,
  RotateCcw,
  LogOut,
  Sparkles,
  Activity,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FadeIn, StaggerGroup, StaggerItem } from '@/components/ui/motion';
import {
  fetchAdminUserDetail,
  updateAdminUserApi,
  deleteAdminUserApi,
  AdminApiError,
} from '@/lib/admin-api';
import { useAdminAuth } from '@/components/admin/admin-auth-context';
import {
  EditUserDialog,
  ResetUserPasswordDialog,
  DeleteUserDialog,
  type EditUserFormState,
} from '@/components/admin/user-management-dialogs';
import type { AdminUserDetail } from '@studyflow/shared';
import { formatBytes } from '@/lib/admin-formatters';
import { toast } from 'sonner';

const MAX_STORAGE_BYTES = 200 * 1024 * 1024; // 200 MB per PRD

function UserDetailSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-6 py-6 px-4 lg:px-6 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-28" />
      </div>

      <Card className="border-border bg-card shadow-xs">
        <CardContent className="p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {Array.from({ length: 5 }).map((_, idx) => (
              <Skeleton key={idx} className="h-9 w-28 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="p-5 pb-4 border-b border-border/60">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
            {Array.from({ length: 8 }).map((_, idx) => (
              <Skeleton key={idx} className="h-22 rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>

      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="p-5 pb-4 border-b border-border/60">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-80" />
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <Skeleton key={idx} className="h-28 rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UserDetailContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { user: currentAdmin } = useAdminAuth();

  const userId = typeof params?.id === 'string' ? params.id : '';

  // Preserve query string for "Kembali" button
  const backHref = React.useMemo(() => {
    const qs = searchParams.toString();
    return qs ? `/users?${qs}` : '/users';
  }, [searchParams]);

  const [userDetail, setUserDetail] = React.useState<AdminUserDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isNotFound, setIsNotFound] = React.useState(false);

  // Copy feedback state
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  // CRUD Dialog states
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [isEditSubmitting, setIsEditSubmitting] = React.useState(false);
  const [editForm, setEditForm] = React.useState<EditUserFormState>({
    name: '',
    email: '',
    role: 'USER',
    timezone: 'Asia/Jakarta',
    emailVerified: true,
  });
  const [editError, setEditError] = React.useState<string | null>(null);

  const [isPasswordOpen, setIsPasswordOpen] = React.useState(false);
  const [isPasswordSubmitting, setIsPasswordSubmitting] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState('');
  const [passwordError, setPasswordError] = React.useState<string | null>(null);

  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [isDeleteSubmitting, setIsDeleteSubmitting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((curr) => (curr === key ? null : curr));
    }, 2000);
  };

  const loadDetail = React.useCallback(
    (signal?: AbortSignal) => {
      if (!userId) return;

      setIsLoading(true);
      setError(null);
      setIsNotFound(false);

      fetchAdminUserDetail(userId, { signal })
        .then((res) => {
          setUserDetail(res);
          setEditForm({
            name: res.name,
            email: res.email,
            role: res.role,
            timezone: res.timezone || 'Asia/Jakarta',
            emailVerified: Boolean(res.emailVerifiedAt),
          });
        })
        .catch((err: unknown) => {
          if (signal?.aborted) return;
          if (err instanceof AdminApiError && err.statusCode === 404) {
            setIsNotFound(true);
          } else {
            setError(err instanceof Error ? err.message : 'Gagal memuat rincian pengguna');
          }
        })
        .finally(() => {
          if (!signal?.aborted) {
            setIsLoading(false);
          }
        });
    },
    [userId]
  );

  React.useEffect(() => {
    const controller = new AbortController();
    loadDetail(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadDetail]);

  // Edit user submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userDetail) return;
    setIsEditSubmitting(true);
    setEditError(null);
    try {
      const updated = await updateAdminUserApi(userDetail.id, editForm);
      setUserDetail(updated.user);
      toast.success('Profil & peran pengguna berhasil diperbarui');
      setIsEditOpen(false);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Gagal memperbarui pengguna');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  // Change password submit
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userDetail) return;
    setIsPasswordSubmitting(true);
    setPasswordError(null);
    try {
      const updated = await updateAdminUserApi(userDetail.id, { newPassword });
      setUserDetail(updated.user);
      toast.success('Kata sandi berhasil direset dan sesi lama telah dicabut');
      setIsPasswordOpen(false);
      setNewPassword('');
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : 'Gagal mereset kata sandi');
    } finally {
      setIsPasswordSubmitting(false);
    }
  };

  // Reset Quota submit
  const handleResetQuota = async () => {
    if (!userDetail) return;
    try {
      const updated = await updateAdminUserApi(userDetail.id, { resetQuota: true });
      setUserDetail(updated.user);
      toast.success(`Kuota AI dan unggahan untuk ${userDetail.name} berhasil direset penuh`);
    } catch (err: unknown) {
      toast.error('Gagal mereset kuota: ' + (err instanceof Error ? err.message : 'Kesalahan tidak diketahui'));
    }
  };

  // Revoke Sessions submit
  const handleRevokeSessions = async () => {
    if (!userDetail) return;
    try {
      const updated = await updateAdminUserApi(userDetail.id, { revokeSessions: true });
      setUserDetail(updated.user);
      toast.success(`Seluruh sesi login aktif untuk ${userDetail.name} berhasil dicabut`);
    } catch (err: unknown) {
      toast.error('Gagal mencabut sesi login: ' + (err instanceof Error ? err.message : 'Kesalahan tidak diketahui'));
    }
  };

  // Delete User submit
  const handleDeleteSubmit = async () => {
    if (!userDetail) return;
    setIsDeleteSubmitting(true);
    setDeleteError(null);
    try {
      await deleteAdminUserApi(userDetail.id);
      toast.success(`Akun ${userDetail.name} berhasil dihapus permanen`);
      setIsDeleteOpen(false);
      router.push(backHref);
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Gagal menghapus pengguna');
      setIsDeleteSubmitting(false);
    }
  };

  if (isLoading) {
    return <UserDetailSkeleton />;
  }

  if (isNotFound) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-4 md:p-8 max-w-xl mx-auto w-full text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <UserX className="h-10 w-10 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
          Pengguna Tidak Ditemukan
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          Akun pengguna dengan ID tersebut tidak ditemukan di sistem atau telah dihapus.
        </p>
        <Button asChild variant="default">
          <Link href={backHref}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali ke Daftar Pengguna
          </Link>
        </Button>
      </div>
    );
  }

  if (error || !userDetail) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" asChild>
            <Link href={backHref} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span>Kembali ke Daftar Pengguna</span>
            </Link>
          </Button>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Terjadi Kesalahan</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4 mt-2">
            <span>{error || 'Gagal memuat rincian pengguna'}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadDetail()}
              className="bg-card text-foreground"
            >
              Coba Lagi
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const isCurrentAdmin = currentAdmin?.id === userDetail.id;
  const usedStorageBytes = userDetail.usageSummary.storageUsage?.usedBytes ?? 0;
  const remainingStorageBytes = Math.max(0, MAX_STORAGE_BYTES - usedStorageBytes);
  const storagePercentage = Math.min(100, Math.round((usedStorageBytes / MAX_STORAGE_BYTES) * 100));

  const dailyGenLimit = userDetail.usageSummary.aiQuota?.dailyLimit ?? 20;
  const dailyGenCount = userDetail.usageSummary.aiQuota?.dailyGenerationCount ?? 0;
  const aiPercentage = Math.min(100, Math.round((dailyGenCount / dailyGenLimit) * 100));
  const activeJobsCount = userDetail.usageSummary.aiQuota?.activeJobsCount ?? 0;
  const activeSessionsCount = userDetail.usageSummary.activeSessionsCount ?? 0;

  const userInitials = userDetail.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'U';

  return (
    <FadeIn className="flex flex-1 flex-col gap-6 py-6 px-4 lg:px-6 max-w-7xl mx-auto w-full">
      {/* Top Navigation & Refresh Bar */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" size="sm" asChild className="h-9 px-3.5 text-xs shadow-xs">
          <Link href={backHref} className="gap-2">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Kembali ke Daftar Pengguna</span>
          </Link>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => loadDetail()}
          disabled={isLoading}
          className="gap-2 h-9 px-3.5 text-xs shadow-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Segarkan Data</span>
        </Button>
      </div>

      {/* 1. Profile Hero & Quick Actions Card */}
      <Card className="border-border bg-card shadow-xs">
        <CardContent className="p-5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary font-bold text-base tracking-tight">
              {userInitials}
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
                  {userDetail.name}
                </h1>
                {userDetail.role === 'ADMIN' ? (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-semibold text-xs gap-1">
                    <Shield className="h-3 w-3" />
                    ADMIN
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="font-normal text-xs gap-1">
                    <User className="h-3 w-3" />
                    USER
                  </Badge>
                )}
                {userDetail.emailVerifiedAt ? (
                  <Badge variant="outline" className="bg-success text-success-foreground border-transparent text-xs">
                    Terverifikasi
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-warning text-warning-foreground border-transparent text-xs">
                    Belum Verifikasi
                  </Badge>
                )}
                {isCurrentAdmin && (
                  <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                    Akun Anda
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-mono truncate">
                {userDetail.email} &bull; ID: {userDetail.id}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-3 xl:pt-0 border-t xl:border-t-0 border-border/60">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditOpen(true)}
              className="gap-1.5 h-9 px-3 text-xs shadow-xs"
            >
              <Edit2 className="h-3.5 w-3.5" />
              <span>Edit Profil</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPasswordOpen(true)}
              className="gap-1.5 h-9 px-3 text-xs shadow-xs"
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>Reset Password</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleResetQuota}
              className="gap-1.5 h-9 px-3 text-xs shadow-xs"
            >
              <RotateCcw className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span>Reset Kuota</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRevokeSessions}
              className="gap-1.5 h-9 px-3 text-xs shadow-xs"
            >
              <LogOut className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
              <span>Cabut Sesi</span>
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsDeleteOpen(true)}
              disabled={isCurrentAdmin}
              className="gap-1.5 h-9 px-3 text-xs shadow-xs"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Hapus Akun</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2. Card: Informasi Akun (4x2 Uniform Grid) */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="p-5 pb-4 border-b border-border/60">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-semibold">Informasi Akun &amp; Kredensial</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Data identitas, hak akses sistem, metode autentikasi, dan status keanggotaan pengguna.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
            {/* 1. Nama Lengkap */}
            <div className="rounded-xl border border-border/70 bg-muted/15 p-3.5 flex flex-col justify-between min-h-[86px]">
              <span className="text-xs font-medium text-muted-foreground">
                Nama Lengkap
              </span>
              <span className="font-semibold text-foreground text-sm truncate mt-1">
                {userDetail.name}
              </span>
            </div>

            {/* 2. Alamat Email */}
            <div className="rounded-xl border border-border/70 bg-muted/15 p-3.5 flex flex-col justify-between min-h-[86px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Alamat Email
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs gap-1 shrink-0 -mr-1 -mt-1"
                  onClick={() => handleCopy(userDetail.email, 'email')}
                >
                  {copiedKey === 'email' ? (
                    <Check className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  <span>{copiedKey === 'email' ? 'Disalin' : 'Salin'}</span>
                </Button>
              </div>
              <span className="font-mono text-xs text-foreground truncate mt-1" title={userDetail.email}>
                {userDetail.email}
              </span>
            </div>

            {/* 3. ID Pengguna */}
            <div className="rounded-xl border border-border/70 bg-muted/15 p-3.5 flex flex-col justify-between min-h-[86px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  ID Pengguna
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs gap-1 shrink-0 -mr-1 -mt-1"
                  onClick={() => handleCopy(userDetail.id, 'id')}
                >
                  {copiedKey === 'id' ? (
                    <Check className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  <span>{copiedKey === 'id' ? 'Disalin' : 'Salin'}</span>
                </Button>
              </div>
              <span className="font-mono text-xs text-muted-foreground truncate mt-1" title={userDetail.id}>
                {userDetail.id}
              </span>
            </div>

            {/* 4. Peran Sistem */}
            <div className="rounded-xl border border-border/70 bg-muted/15 p-3.5 flex flex-col justify-between min-h-[86px]">
              <span className="text-xs font-medium text-muted-foreground">
                Peran Sistem (Role)
              </span>
              <div className="mt-1">
                {userDetail.role === 'ADMIN' ? (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-semibold text-xs gap-1">
                    <Shield className="h-3 w-3" />
                    ADMIN
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="font-normal text-xs gap-1">
                    <User className="h-3 w-3" />
                    USER (Mahasiswa)
                  </Badge>
                )}
              </div>
            </div>

            {/* 5. Status Verifikasi Email */}
            <div className="rounded-xl border border-border/70 bg-muted/15 p-3.5 flex flex-col justify-between min-h-[86px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Status Verifikasi
                </span>
                {userDetail.emailVerifiedAt ? (
                  <Badge variant="outline" className="bg-success text-success-foreground border-transparent text-xs">
                    Terverifikasi
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-warning text-warning-foreground border-transparent text-xs">
                    Belum Verifikasi
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground tabular-nums truncate mt-1">
                {userDetail.emailVerifiedAt
                  ? `Pada ${new Date(userDetail.emailVerifiedAt).toLocaleString('id-ID', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}`
                  : 'Menunggu konfirmasi tautan email'}
              </span>
            </div>

            {/* 6. Metode Login */}
            <div className="rounded-xl border border-border/70 bg-muted/15 p-3.5 flex flex-col justify-between min-h-[86px]">
              <span className="text-xs font-medium text-muted-foreground">
                Metode Login
              </span>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                {userDetail.authMethods.hasPassword && (
                  <Badge variant="outline" className="gap-1 text-xs bg-card">
                    <KeyRound className="h-3 w-3" />
                    Kata Sandi
                  </Badge>
                )}
                {userDetail.authMethods.hasGoogle && (
                  <Badge variant="outline" className="gap-1 text-xs bg-primary/10 text-primary border-primary/20">
                    <Mail className="h-3 w-3" />
                    Google OAuth
                  </Badge>
                )}
                {!userDetail.authMethods.hasPassword && !userDetail.authMethods.hasGoogle && (
                  <span className="text-xs text-muted-foreground">Tidak tercatat</span>
                )}
              </div>
            </div>

            {/* 7. Zona Waktu */}
            <div className="rounded-xl border border-border/70 bg-muted/15 p-3.5 flex flex-col justify-between min-h-[86px]">
              <span className="text-xs font-medium text-muted-foreground">
                Zona Waktu
              </span>
              <div className="flex items-center gap-1.5 mt-1 text-foreground">
                <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="font-mono text-xs sm:text-sm truncate">
                  {userDetail.timezone || 'Asia/Jakarta'}
                </span>
              </div>
            </div>

            {/* 8. Tanggal Bergabung */}
            <div className="rounded-xl border border-border/70 bg-muted/15 p-3.5 flex flex-col justify-between min-h-[86px]">
              <span className="text-xs font-medium text-muted-foreground">
                Tanggal Bergabung
              </span>
              <div className="flex items-center gap-1.5 mt-1 text-foreground">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs sm:text-sm tabular-nums truncate">
                  {new Date(userDetail.createdAt).toLocaleString('id-ID', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-2.5 text-xs text-muted-foreground">
            <Info className="h-4 w-4 text-primary shrink-0" />
            <span>
              Konten dokumen pribadi, isi catatan, dan riwayat percakapan pengguna dilindungi secara hanya-baca dan tidak diekspos pada detail akun.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 3. Two-Column Quota & Capacity Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Storage Quota Card */}
        <Card className="border-border bg-card shadow-xs flex h-full flex-col justify-between">
          <CardHeader className="p-5 pb-4 border-b border-border/60">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-primary" />
                <CardTitle className="text-base font-semibold">Kapasitas Penyimpanan PDF</CardTitle>
              </div>
              <Badge variant="outline" className="text-xs font-mono tabular-nums shrink-0">
                {storagePercentage}% Terpakai
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Batas kuota penyimpanan berkas PDF mahasiswa ({formatBytes(MAX_STORAGE_BYTES)}).
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 flex-1 flex flex-col justify-between gap-4">
            <div className="space-y-2">
              <Progress value={storagePercentage} className="h-2.5" />
              <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
                <span>0 B</span>
                <span>Batas Maksimum: {formatBytes(MAX_STORAGE_BYTES)}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-muted/15 p-3">
                <span className="text-xs text-muted-foreground block">Ruang Digunakan</span>
                <span className="text-sm sm:text-base font-bold text-foreground tabular-nums mt-0.5 block">
                  {formatBytes(usedStorageBytes)}
                </span>
              </div>
              <div className="rounded-lg border border-border bg-muted/15 p-3">
                <span className="text-xs text-muted-foreground block">Ruang Tersisa</span>
                <span className="text-sm sm:text-base font-bold text-foreground tabular-nums mt-0.5 block">
                  {formatBytes(remainingStorageBytes)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Quota Card */}
        <Card className="border-border bg-card shadow-xs flex h-full flex-col justify-between">
          <CardHeader className="p-5 pb-4 border-b border-border/60">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <CardTitle className="text-base font-semibold">Kuota Generasi AI Harian</CardTitle>
              </div>
              <Badge variant="outline" className="text-xs font-mono tabular-nums shrink-0">
                {dailyGenCount} / {dailyGenLimit} Hari Ini
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Penggunaan ringkasan, flashcard, dan kuis AI yang direset setiap hari (00:00 UTC).
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 flex-1 flex flex-col justify-between gap-4">
            <div className="space-y-2">
              <Progress value={aiPercentage} className="h-2.5" />
              <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
                <span>{aiPercentage}% kuota harian terpakai</span>
                <span>Batas Harian: {dailyGenLimit} generasi</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-muted/15 p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Pekerjaan AI Aktif</span>
                  <Activity className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-sm sm:text-base font-bold text-foreground tabular-nums mt-0.5 block">
                  {activeJobsCount} antrean
                </span>
              </div>
              <div className="rounded-lg border border-border bg-muted/15 p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Sesi Login Aktif</span>
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <span className="text-sm sm:text-base font-bold text-foreground tabular-nums mt-0.5 block">
                  {activeSessionsCount} perangkat
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. Card: Ringkasan Penggunaan Platform (6 Symmetric Metric Cards) */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="p-5 pb-4 border-b border-border/60">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-semibold">Ringkasan Penggunaan Platform</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Jumlah entitas akademik aktif dan pemakaian ruang penyimpanan pengguna di sistem StudyFlow.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5">
          <StaggerGroup className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* 1. Semester */}
            <StaggerItem className="rounded-xl border border-border/70 p-4 bg-muted/15 flex flex-col items-center justify-center text-center">
              <div className="rounded-full bg-primary/10 p-2.5 mb-2.5 text-primary">
                <GraduationCap className="h-4 w-4" />
              </div>
              <span className="text-2xl font-bold text-foreground tabular-nums">
                {userDetail.usageSummary.semesters}
              </span>
              <span className="text-xs text-muted-foreground mt-1">Semester</span>
            </StaggerItem>

            {/* 2. Mata Kuliah */}
            <StaggerItem className="rounded-xl border border-border/70 p-4 bg-muted/15 flex flex-col items-center justify-center text-center">
              <div className="rounded-full bg-primary/10 p-2.5 mb-2.5 text-primary">
                <BookOpen className="h-4 w-4" />
              </div>
              <span className="text-2xl font-bold text-foreground tabular-nums">
                {userDetail.usageSummary.courses}
              </span>
              <span className="text-xs text-muted-foreground mt-1">Mata Kuliah</span>
            </StaggerItem>

            {/* 3. Materi Aktif */}
            <StaggerItem className="rounded-xl border border-border/70 p-4 bg-muted/15 flex flex-col items-center justify-center text-center">
              <div className="rounded-full bg-primary/10 p-2.5 mb-2.5 text-primary">
                <FileText className="h-4 w-4" />
              </div>
              <span className="text-2xl font-bold text-foreground tabular-nums">
                {userDetail.usageSummary.materials}
              </span>
              <span className="text-xs text-muted-foreground mt-1">Materi Aktif</span>
            </StaggerItem>

            {/* 4. Tugas Kuliah */}
            <StaggerItem className="rounded-xl border border-border/70 p-4 bg-muted/15 flex flex-col items-center justify-center text-center">
              <div className="rounded-full bg-primary/10 p-2.5 mb-2.5 text-primary">
                <CheckSquare className="h-4 w-4" />
              </div>
              <span className="text-2xl font-bold text-foreground tabular-nums">
                {userDetail.usageSummary.assignments}
              </span>
              <span className="text-xs text-muted-foreground mt-1">Tugas Kuliah</span>
            </StaggerItem>

            {/* 5. Catatan Belajar */}
            <StaggerItem className="rounded-xl border border-border/70 p-4 bg-muted/15 flex flex-col items-center justify-center text-center">
              <div className="rounded-full bg-primary/10 p-2.5 mb-2.5 text-primary">
                <StickyNote className="h-4 w-4" />
              </div>
              <span className="text-2xl font-bold text-foreground tabular-nums">
                {userDetail.usageSummary.notes}
              </span>
              <span className="text-xs text-muted-foreground mt-1">Catatan Belajar</span>
            </StaggerItem>

            {/* 6. Penggunaan Penyimpanan */}
            <StaggerItem className="rounded-xl border border-border/70 p-4 bg-muted/15 flex flex-col items-center justify-center text-center">
              <div className="rounded-full bg-primary/10 p-2.5 mb-2.5 text-primary">
                <HardDrive className="h-4 w-4" />
              </div>
              <span className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">
                {formatBytes(usedStorageBytes)}
              </span>
              <span className="text-xs text-muted-foreground mt-1">Penyimpanan</span>
            </StaggerItem>
          </StaggerGroup>
        </CardContent>
      </Card>

      <EditUserDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        form={editForm}
        onFormChange={setEditForm}
        onSubmit={handleEditSubmit}
        isSubmitting={isEditSubmitting}
        error={editError}
        isCurrentAdmin={isCurrentAdmin}
      />

      <ResetUserPasswordDialog
        open={isPasswordOpen}
        onOpenChange={setIsPasswordOpen}
        newPassword={newPassword}
        onNewPasswordChange={setNewPassword}
        onSubmit={handlePasswordSubmit}
        isSubmitting={isPasswordSubmitting}
        error={passwordError}
      />

      <DeleteUserDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        user={userDetail}
        onConfirm={handleDeleteSubmit}
        isSubmitting={isDeleteSubmitting}
        error={deleteError}
        isCurrentAdmin={isCurrentAdmin}
      />
    </FadeIn>
  );
}

export default function UserDetailPage() {
  return (
    <React.Suspense fallback={<UserDetailSkeleton />}>
      <UserDetailContent />
    </React.Suspense>
  );
}
