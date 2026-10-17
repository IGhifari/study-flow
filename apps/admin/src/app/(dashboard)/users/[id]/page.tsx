'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FadeIn, StaggerGroup, StaggerItem } from '@/components/ui/motion';
import { fetchAdminUserDetail, AdminApiError } from '@/lib/admin-api';
import { AdminUserDetail } from '@studyflow/shared';

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
  const params = useParams();
  const searchParams = useSearchParams();

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

  const handleRetry = () => {
    loadDetail();
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
              onClick={handleRetry}
              className="bg-card text-foreground"
            >
              Coba Lagi
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <FadeIn className="flex flex-1 flex-col gap-6 p-4 md:p-8 max-w-5xl mx-auto w-full">
      {/* Page Header and Back Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href={backHref} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span>Kembali</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Detail Pengguna
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Informasi akun dan ringkasan penggunaan platform
            </p>
          </div>
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

      <div className="grid grid-cols-1 gap-6">
        {/* Card 1: Informasi Akun */}
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

            {/* Note alert */}
            <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
              <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>
                Halaman ini bersifat <strong>read-only</strong>. Modifikasi profil, perubahan peran, dan aksi administratif lanjutan dilindungi demi menjaga integritas data akademik pengguna.
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Ringkasan Penggunaan Platform */}
        <Card className="border-border bg-card shadow-xs">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Ringkasan Penggunaan</CardTitle>
            </div>
            <CardDescription>
              Jumlah entitas akademik dan penggunaan ruang penyimpanan pengguna (hitungan materi hanya mencakup materi aktif).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StaggerGroup className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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

              {/* Penyimpanan */}
              <StaggerItem className="rounded-lg border border-border/70 p-4 bg-muted/30 flex flex-col items-center justify-center text-center">
                <div className="rounded-full bg-primary/10 p-2 mb-2 text-primary">
                  <HardDrive className="h-4 w-4" />
                </div>
                <span className="text-lg font-bold text-foreground truncate max-w-full tabular-nums">
                  {userDetail.usageSummary.storageUsage
                    ? userDetail.usageSummary.storageUsage.formatted
                    : '0 B'}
                </span>
                <span className="text-xs text-muted-foreground mt-1">Penyimpanan</span>
              </StaggerItem>
            </StaggerGroup>
          </CardContent>
        </Card>
      </div>
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
