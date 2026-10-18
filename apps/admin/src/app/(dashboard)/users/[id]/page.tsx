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
  Loader2,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
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
import { useAdminAuth } from '@/components/admin-auth-context';
import type { AdminUserDetail, Role } from '@studyflow/shared';
import { formatBytes } from '@/lib/admin-formatters';
import { toast } from 'sonner';

const MAX_STORAGE_BYTES = 200 * 1024 * 1024; // 200 MB per PRD

function UserDetailSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-24" />
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-80" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={idx} className="h-24 rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
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
  const [editForm, setEditForm] = React.useState({
    name: '',
    email: '',
    role: 'USER' as Role,
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
        .catch((err: any) => {
          if (signal?.aborted) return;
          if (err instanceof AdminApiError && err.statusCode === 404) {
            setIsNotFound(true);
          } else {
            setError(err.message || 'Gagal memuat rincian pengguna');
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
    } catch (err: any) {
      setEditError(err.message || 'Gagal memperbarui pengguna');
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
    } catch (err: any) {
      setPasswordError(err.message || 'Gagal mereset kata sandi');
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
    } catch (err: any) {
      toast.error('Gagal mereset kuota: ' + err.message);
    }
  };

  // Revoke Sessions submit
  const handleRevokeSessions = async () => {
    if (!userDetail) return;
    try {
      const updated = await updateAdminUserApi(userDetail.id, { revokeSessions: true });
      setUserDetail(updated.user);
      toast.success(`Seluruh sesi login aktif untuk ${userDetail.name} berhasil dicabut`);
    } catch (err: any) {
      toast.error('Gagal mencabut sesi login: ' + err.message);
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
    } catch (err: any) {
      setDeleteError(err.message || 'Gagal menghapus pengguna');
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
  const storagePercentage = Math.min(100, Math.round((usedStorageBytes / MAX_STORAGE_BYTES) * 100));

  const dailyGenLimit = userDetail.usageSummary.aiQuota?.dailyLimit ?? 20;
  const dailyGenCount = userDetail.usageSummary.aiQuota?.dailyGenerationCount ?? 0;
  const aiPercentage = Math.min(100, Math.round((dailyGenCount / dailyGenLimit) * 100));
  const activeJobsCount = userDetail.usageSummary.aiQuota?.activeJobsCount ?? 0;
  const activeSessionsCount = userDetail.usageSummary.activeSessionsCount ?? 0;

  return (
    <FadeIn className="flex flex-1 flex-col gap-6 p-4 md:p-8 max-w-5xl mx-auto w-full">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href={backHref} className="gap-2 h-9">
              <ArrowLeft className="h-4 w-4" />
              <span>Kembali</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl flex items-center gap-2">
              {userDetail.name}
              {isCurrentAdmin && (
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                  Akun Anda
                </Badge>
              )}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">
              {userDetail.email} &bull; ID: {userDetail.id}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditOpen(true)}
            className="gap-1.5 h-9 text-xs"
          >
            <Edit2 className="h-3.5 w-3.5" />
            <span>Edit Profil</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPasswordOpen(true)}
            className="gap-1.5 h-9 text-xs"
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>Reset Password</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleResetQuota}
            className="gap-1.5 h-9 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Kuota</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRevokeSessions}
            className="gap-1.5 h-9 text-xs text-orange-600 dark:text-orange-400 hover:text-orange-700"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Cabut Sesi</span>
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => setIsDeleteOpen(true)}
            disabled={isCurrentAdmin}
            className="gap-1.5 h-9 text-xs"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Hapus Akun</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Card 1: Kuota & Kapasitas Akun (Progress Gauges) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Storage Quota Card */}
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">Kapasitas Penyimpanan PDF</CardTitle>
                </div>
                <Badge variant="outline" className="text-xs font-mono tabular-nums">
                  {storagePercentage}% Terpakai
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Batas kuota penyimpanan berkas PDF mahasiswa ({formatBytes(MAX_STORAGE_BYTES)}).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={storagePercentage} className="h-2.5" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {formatBytes(usedStorageBytes)} digunakan
                </span>
                <span>Tersisa {formatBytes(Math.max(0, MAX_STORAGE_BYTES - usedStorageBytes))}</span>
              </div>
            </CardContent>
          </Card>

          {/* AI Quota Card */}
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <CardTitle className="text-base">Kuota Generasi AI Harian</CardTitle>
                </div>
                <Badge variant="outline" className="text-xs font-mono tabular-nums">
                  {dailyGenCount} / {dailyGenLimit} Hari Ini
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Penggunaan ringkasan, flashcard, dan kuis AI yang direset setiap hari (00:00 UTC).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={aiPercentage} className="h-2.5" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1 font-medium text-foreground">
                  <Activity className="h-3 w-3 text-primary" />
                  {activeJobsCount} pekerjaan AI aktif
                </span>
                <span className="flex items-center gap-1">
                  <Layers className="h-3 w-3 text-muted-foreground" />
                  {activeSessionsCount} sesi login aktif
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Card 2: Informasi Akun */}
        <Card className="border-border bg-card shadow-xs">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Informasi Akun</CardTitle>
            </div>
            <CardDescription>
              Data identitas, hak akses, dan status keanggotaan pengguna.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {/* Nama Lengkap */}
              <div className="rounded-md border border-border/60 p-3 bg-muted/20">
                <span className="text-xs font-medium text-muted-foreground block">
                  Nama Lengkap
                </span>
                <span className="font-semibold text-foreground text-base mt-0.5 block">
                  {userDetail.name}
                </span>
              </div>

              {/* Email */}
              <div className="rounded-md border border-border/60 p-3 bg-muted/20">
                <span className="text-xs font-medium text-muted-foreground block">
                  Alamat Email
                </span>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="font-mono text-sm text-foreground truncate">
                    {userDetail.email}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1 shrink-0"
                    onClick={() => handleCopy(userDetail.email, 'email')}
                  >
                    {copiedKey === 'email' ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    <span>{copiedKey === 'email' ? 'Disalin' : 'Salin'}</span>
                  </Button>
                </div>
              </div>

              {/* ID Pengguna */}
              <div className="rounded-md border border-border/60 p-3 bg-muted/20">
                <span className="text-xs font-medium text-muted-foreground block">
                  ID Pengguna
                </span>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="font-mono text-xs text-muted-foreground truncate">
                    {userDetail.id}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1 shrink-0"
                    onClick={() => handleCopy(userDetail.id, 'id')}
                  >
                    {copiedKey === 'id' ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    <span>{copiedKey === 'id' ? 'Disalin' : 'Salin'}</span>
                  </Button>
                </div>
              </div>

              {/* Peran Sistem */}
              <div className="rounded-md border border-border/60 p-3 bg-muted/20">
                <span className="text-xs font-medium text-muted-foreground block mb-1">
                  Peran Sistem (Role)
                </span>
                {userDetail.role === 'ADMIN' ? (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-semibold gap-1">
                    <Shield className="h-3.5 w-3.5" />
                    ADMIN
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="font-normal gap-1">
                    <User className="h-3.5 w-3.5" />
                    USER (Mahasiswa)
                  </Badge>
                )}
              </div>

              {/* Status Verifikasi Email */}
              <div className="rounded-md border border-border/60 p-3 bg-muted/20">
                <span className="text-xs font-medium text-muted-foreground block mb-1">
                  Status Verifikasi Email
                </span>
                <div className="flex flex-col gap-1">
                  {userDetail.emailVerifiedAt ? (
                    <>
                      <Badge variant="outline" className="w-fit bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 text-xs">
                        Terverifikasi
                      </Badge>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        Diverifikasi pada:{' '}
                        {new Date(userDetail.emailVerifiedAt).toLocaleString('id-ID', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    </>
                  ) : (
                    <Badge variant="outline" className="w-fit bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800 text-xs">
                      Belum Verifikasi
                    </Badge>
                  )}
                </div>
              </div>

              {/* Metode Login */}
              <div className="rounded-md border border-border/60 p-3 bg-muted/20">
                <span className="text-xs font-medium text-muted-foreground block mb-1">
                  Metode Login
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {userDetail.authMethods.hasPassword && (
                    <Badge variant="outline" className="gap-1 text-xs">
                      <KeyRound className="h-3 w-3" />
                      Kata Sandi
                    </Badge>
                  )}
                  {userDetail.authMethods.hasGoogle && (
                    <Badge variant="outline" className="gap-1 text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                      <Mail className="h-3 w-3" />
                      Google OAuth
                    </Badge>
                  )}
                  {!userDetail.authMethods.hasPassword && !userDetail.authMethods.hasGoogle && (
                    <span className="text-xs text-muted-foreground">Tidak tercatat</span>
                  )}
                </div>
              </div>

              {/* Zona Waktu */}
              <div className="rounded-md border border-border/60 p-3 bg-muted/20">
                <span className="text-xs font-medium text-muted-foreground block">
                  Zona Waktu
                </span>
                <div className="flex items-center gap-1.5 mt-1 text-foreground">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-sm">{userDetail.timezone || 'Asia/Jakarta'}</span>
                </div>
              </div>

              {/* Tanggal Bergabung */}
              <div className="rounded-md border border-border/60 p-3 bg-muted/20">
                <span className="text-xs font-medium text-muted-foreground block">
                  Tanggal Bergabung
                </span>
                <div className="flex items-center gap-1.5 mt-1 text-foreground">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm tabular-nums">
                    {new Date(userDetail.createdAt).toLocaleString('id-ID', {
                      dateStyle: 'full',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Ringkasan Penggunaan Platform */}
        <Card className="border-border bg-card shadow-xs">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Ringkasan Entitas Akademik</CardTitle>
            </div>
            <CardDescription>
              Jumlah entitas akademik aktif yang dibuat pengguna di sistem StudyFlow.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StaggerGroup className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* Semester */}
              <StaggerItem className="rounded-lg border border-border/70 p-4 bg-muted/30 flex flex-col items-center justify-center text-center">
                <div className="rounded-full bg-primary/10 p-2 mb-2 text-primary">
                  <GraduationCap className="h-4 w-4" />
                </div>
                <span className="text-2xl font-bold text-foreground tabular-nums">
                  {userDetail.usageSummary.semesters}
                </span>
                <span className="text-xs text-muted-foreground mt-1">Semester</span>
              </StaggerItem>

              {/* Mata Kuliah */}
              <StaggerItem className="rounded-lg border border-border/70 p-4 bg-muted/30 flex flex-col items-center justify-center text-center">
                <div className="rounded-full bg-primary/10 p-2 mb-2 text-primary">
                  <BookOpen className="h-4 w-4" />
                </div>
                <span className="text-2xl font-bold text-foreground tabular-nums">
                  {userDetail.usageSummary.courses}
                </span>
                <span className="text-xs text-muted-foreground mt-1">Mata Kuliah</span>
              </StaggerItem>

              {/* Materi Aktif */}
              <StaggerItem className="rounded-lg border border-border/70 p-4 bg-muted/30 flex flex-col items-center justify-center text-center">
                <div className="rounded-full bg-primary/10 p-2 mb-2 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <span className="text-2xl font-bold text-foreground tabular-nums">
                  {userDetail.usageSummary.materials}
                </span>
                <span className="text-xs text-muted-foreground mt-1">Materi Aktif</span>
              </StaggerItem>

              {/* Tugas */}
              <StaggerItem className="rounded-lg border border-border/70 p-4 bg-muted/30 flex flex-col items-center justify-center text-center">
                <div className="rounded-full bg-primary/10 p-2 mb-2 text-primary">
                  <CheckSquare className="h-4 w-4" />
                </div>
                <span className="text-2xl font-bold text-foreground tabular-nums">
                  {userDetail.usageSummary.assignments}
                </span>
                <span className="text-xs text-muted-foreground mt-1">Tugas Kuliah</span>
              </StaggerItem>

              {/* Catatan */}
              <StaggerItem className="rounded-lg border border-border/70 p-4 bg-muted/30 flex flex-col items-center justify-center text-center">
                <div className="rounded-full bg-primary/10 p-2 mb-2 text-primary">
                  <StickyNote className="h-4 w-4" />
                </div>
                <span className="text-2xl font-bold text-foreground tabular-nums">
                  {userDetail.usageSummary.notes}
                </span>
                <span className="text-xs text-muted-foreground mt-1">Catatan Belajar</span>
              </StaggerItem>
            </StaggerGroup>
          </CardContent>
        </Card>
      </div>

      {/* Modal 1: Edit Akun & Peran */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-primary" />
              Edit Profil &amp; Peran
            </DialogTitle>
            <DialogDescription>
              Ubah rincian akun, hak akses peran, serta zona waktu pengguna.
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
                  disabled={isCurrentAdmin}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER" className="text-xs">Mahasiswa (USER)</SelectItem>
                    <SelectItem value="ADMIN" className="text-xs">Administrator</SelectItem>
                  </SelectContent>
                </Select>
                {isCurrentAdmin && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
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
                id="edit-verified-checkbox"
                checked={editForm.emailVerified}
                onCheckedChange={(checked) =>
                  setEditForm({ ...editForm, emailVerified: Boolean(checked) })
                }
              />
              <Label htmlFor="edit-verified-checkbox" className="text-xs cursor-pointer">
                Email terverifikasi
              </Label>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditOpen(false)}
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
                <span>Simpan Perubahan</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Reset Kata Sandi */}
      <Dialog open={isPasswordOpen} onOpenChange={setIsPasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Reset Kata Sandi Pengguna
            </DialogTitle>
            <DialogDescription>
              Masukkan kata sandi baru untuk pengguna ini. Seluruh sesi aktif pengguna akan otomatis dicabut.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePasswordSubmit} className="space-y-4 py-2">
            {passwordError && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{passwordError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-xs font-semibold">Kata Sandi Baru</Label>
              <Input
                id="new-password"
                type="password"
                required
                minLength={8}
                placeholder="Minimal 8 karakter..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsPasswordOpen(false);
                  setNewPassword('');
                }}
                disabled={isPasswordSubmitting}
                className="h-9 text-xs"
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPasswordSubmitting}
                className="h-9 text-xs gap-1.5"
              >
                {isPasswordSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Reset Kata Sandi</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 3: Konfirmasi Hapus Akun */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Hapus Akun Pengguna
            </DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus akun <strong>{userDetail.name}</strong>? Tindakan ini permanen dan akan menghapus seluruh data akademik terkait.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <Alert variant="destructive" className="py-2 my-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{deleteError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteOpen(false)}
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
              disabled={isDeleteSubmitting || isCurrentAdmin}
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

export default function UserDetailPage() {
  return (
    <React.Suspense fallback={<UserDetailSkeleton />}>
      <UserDetailContent />
    </React.Suspense>
  );
}
