'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings,
  User,
  KeyRound,
  Palette,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  HardDrive,
  FileUp,
  Info,
  Clock,
} from 'lucide-react';
import {
  UpdateProfileInput,
  UpdateProfileInputSchema,
  ChangePasswordInput,
  formatFileSize,
  StorageUsageResponse,
  UserProfile,
} from '@studyflow/shared';
import { apiUpdateProfile, apiChangePassword, getCurrentUser } from '@/lib/auth-client';
import { getStorageUsage } from '@/lib/material-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import {
  RadixSelect,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { ThemeToggle } from '@/components/theme-toggle';

const TIMEZONE_OPTIONS = [
  { value: 'Asia/Jakarta', label: 'WIB — Asia/Jakarta (UTC+7, Indonesia Barat)' },
  { value: 'Asia/Makassar', label: 'WITA — Asia/Makassar (UTC+8, Indonesia Tengah)' },
  { value: 'Asia/Jayapura', label: 'WIT — Asia/Jayapura (UTC+9, Indonesia Timur)' },
  { value: 'Asia/Pontianak', label: 'WIB — Asia/Pontianak (UTC+7, Kalimantan Barat)' },
  { value: 'Asia/Singapore', label: 'SGT — Asia/Singapore (UTC+8)' },
  { value: 'Asia/Tokyo', label: 'JST — Asia/Tokyo (UTC+9)' },
  { value: 'UTC', label: 'UTC — Universal Time Coordinated' },
];

export default function SettingsPage(): React.JSX.Element {
  const router = useRouter();

  // User & Profile State
  const [currentUser, setCurrentUser] = React.useState<UserProfile | null>(null);
  const [name, setName] = React.useState('');
  const [timezone, setTimezone] = React.useState('Asia/Jakarta');
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [isProfileSubmitting, setIsProfileSubmitting] = React.useState(false);
  const [profileSuccess, setProfileSuccess] = React.useState<string | null>(null);
  const [profileError, setProfileError] = React.useState<string | null>(null);

  // Password State
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [isPasswordSubmitting, setIsPasswordSubmitting] = React.useState(false);
  const [passwordSuccess, setPasswordSuccess] = React.useState<string | null>(null);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);

  // Storage Usage State
  const [storageUsage, setStorageUsage] = React.useState<StorageUsageResponse | null>(null);
  const [storageLoading, setStorageLoading] = React.useState(true);

  // Load User Data & Storage on Mount
  React.useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const user = await getCurrentUser();
        if (isMounted && user) {
          setCurrentUser(user);
          setName(user.name);
          setTimezone(user.timezone || 'Asia/Jakarta');
        }
      } catch (err) {
        console.error('Failed to load current user:', err);
      } finally {
        if (isMounted) setInitialLoading(false);
      }

      try {
        const usage = await getStorageUsage();
        if (isMounted) setStorageUsage(usage);
      } catch (err) {
        console.error('Failed to load storage usage:', err);
      } finally {
        if (isMounted) setStorageLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Dirty State Detection for Profile
  const isProfileDirty = React.useMemo(() => {
    if (!currentUser) return false;
    return name.trim() !== currentUser.name || timezone !== currentUser.timezone;
  }, [currentUser, name, timezone]);

  // Profile Submit Handler
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess(null);
    setProfileError(null);

    const trimmedName = name.trim();
    const parseResult = UpdateProfileInputSchema.safeParse({
      name: trimmedName,
      timezone,
    });

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Input profil tidak valid';
      setProfileError(firstError);
      return;
    }

    setIsProfileSubmitting(true);
    try {
      const payload: UpdateProfileInput = {
        name: trimmedName,
        timezone,
      };

      const updated = await apiUpdateProfile(payload);
      setCurrentUser(updated);
      setName(updated.name);
      setTimezone(updated.timezone);
      setProfileSuccess('Profil dan zona waktu berhasil diperbarui.');

      // Sinkronkan nama/avatar header aplikasi secara instan
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('studyflow:profile-updated', { detail: updated })
        );
      }
      router.refresh();
    } catch (err: any) {
      // Pertahankan input pengguna saat request gagal
      setProfileError(err.message || 'Gagal memperbarui profil.');
    } finally {
      setIsProfileSubmitting(false);
    }
  };

  // Password Submit Handler
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError('Password saat ini wajib diisi.');
      return;
    }

    if (newPassword.length < 12) {
      setPasswordError('Password baru minimal 12 karakter.');
      return;
    }

    if (newPassword.length > 128) {
      setPasswordError('Password baru maksimal 128 karakter.');
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError('Password baru harus berbeda dari password saat ini.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Konfirmasi password baru tidak cocok.');
      return;
    }

    setIsPasswordSubmitting(true);
    try {
      const payload: ChangePasswordInput = {
        currentPassword,
        newPassword,
      };

      const msg = await apiChangePassword(payload);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess(msg || 'Password berhasil diubah. Seluruh sesi lain telah dicabut.');

      // Alihkan ke login setelah sesi dicabut oleh backend
      setTimeout(() => {
        router.push('/login');
      }, 1500);
    } catch (err: any) {
      // Jangan menutup form dan tampilkan pesan kesalahan aktual
      setPasswordError(err.message || 'Gagal mengganti password. Periksa password saat ini.');
    } finally {
      setIsPasswordSubmitting(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-96" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* 1. Header Halaman */}
      <div className="border-b border-border pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl flex items-center gap-2.5">
          <Settings className="h-7 w-7 text-primary" aria-hidden="true" />
          Pengaturan Akun
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kelola profil pengguna, zona waktu akademik, preferensi tampilan, dan keamanan akun Anda.
        </p>
      </div>

      {/* 2. Section: Profil Pengguna & Zona Waktu */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
              <User className="h-4 w-4" />
              <span>Profil Pengguna</span>
            </div>
            {isProfileDirty && (
              <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400 text-xs">
                Perubahan belum disimpan
              </Badge>
            )}
          </div>
          <CardTitle className="text-lg">Informasi Profil & Zona Waktu</CardTitle>
          <CardDescription>
            Nama tampilan dan zona waktu yang digunakan untuk menyelaraskan jadwal, deadline tugas, dan kalender belajar.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleProfileSubmit} noValidate>
          <CardContent className="space-y-4">
            {profileSuccess && (
              <Alert variant="default" className="border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <AlertDescription>{profileSuccess}</AlertDescription>
              </Alert>
            )}

            {profileError && (
              <Alert variant="destructive" role="alert">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{profileError}</AlertDescription>
              </Alert>
            )}

            {/* Email (Read-Only) */}
            <div className="space-y-1.5">
              <Label htmlFor="profile-email">Email</Label>
              <Input
                id="profile-email"
                value={currentUser?.email || ''}
                disabled
                readOnly
                aria-readonly="true"
                className="bg-muted/50 cursor-not-allowed text-muted-foreground font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Email terikat permanen dengan akun StudyFlow Anda dan tidak dapat diubah.
              </p>
            </div>

            <Separator />

            {/* Nama Lengkap */}
            <div className="space-y-1.5">
              <Label htmlFor="profile-name">
                Nama Lengkap <span className="text-destructive">*</span>
              </Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isProfileSubmitting}
                placeholder="Nama lengkap Anda"
                autoComplete="name"
                required
              />
              <p className="text-xs text-muted-foreground">
                Nama ini ditampilkan pada header aplikasi, salam dashboard, dan catatan belajar.
              </p>
            </div>

            {/* Zona Waktu */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="profile-timezone">Zona Waktu Akademik</Label>
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              </div>

              <RadixSelect
                value={timezone}
                onValueChange={(val) => setTimezone(val)}
                disabled={isProfileSubmitting}
              >
                <SelectTrigger id="profile-timezone" className="h-9 text-sm" aria-label="Pilih zona waktu akademik">
                  <SelectValue placeholder="Pilih zona waktu" />
                </SelectTrigger>
                <SelectContent className="max-w-[calc(100vw-2rem)] sm:max-w-[420px]">
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </RadixSelect>

              <p className="text-xs text-muted-foreground">
                Seluruh tanggal tugas, deadline, dan waktu pembaruan catatan dikonversi otomatis sesuai zona waktu ini.
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex items-center justify-between border-t border-border pt-4">
            <span className="text-xs text-muted-foreground">
              {isProfileDirty ? 'Klik tombol untuk menyimpan perubahan' : 'Data profil tersinkronisasi'}
            </span>
            <Button
              type="submit"
              size="standard"
              disabled={isProfileSubmitting || !isProfileDirty}
              className="gap-1.5 shrink-0"
            >
              {isProfileSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                'Simpan Profil'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* 3. Section: Preferensi Tampilan */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <Palette className="h-4 w-4" />
            <span>Tampilan & Tema</span>
          </div>
          <CardTitle className="text-lg">Preferensi Antarmuka</CardTitle>
          <CardDescription>
            Pilih mode tema yang nyaman untuk membaca materi kuliah dalam jangka waktu lama.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-border p-4 bg-muted/20">
            <div>
              <p className="text-sm font-medium text-foreground">Mode Tema</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Mendukung tema Sistem otomatis, Terang (kertas bersih), dan Gelap (tinta lembut).
              </p>
            </div>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>

      {/* 4. Section: Keamanan Akun (Ganti Password) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <KeyRound className="h-4 w-4" />
            <span>Keamanan Akun</span>
          </div>
          <CardTitle className="text-lg">Ganti Password</CardTitle>
          <CardDescription>
            Perbarui password akun Anda secara berkala untuk menjaga kerahasiaan data belajar.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handlePasswordSubmit} noValidate>
          <CardContent className="space-y-4">
            {passwordSuccess && (
              <Alert variant="default" className="border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <AlertDescription>
                  {passwordSuccess} Mengarahkan ke halaman login...
                </AlertDescription>
              </Alert>
            )}

            {passwordError && (
              <Alert variant="destructive" role="alert">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{passwordError}</AlertDescription>
              </Alert>
            )}

            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                <Info className="h-3.5 w-3.5" /> Konsekuensi Penggantian Password:
              </p>
              <p>
                Mengganti password akan mencabut seluruh sesi login aktif di semua perangkat. Anda akan diminta masuk kembali dengan password baru.
              </p>
            </div>

            {/* Current Password */}
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">
                Password Saat Ini <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Masukkan password saat ini"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={isPasswordSubmitting}
                  className="pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((prev) => !prev)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground after:absolute after:-inset-2 sm:after:hidden touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={showCurrentPassword ? 'Sembunyikan password saat ini' : 'Tampilkan password saat ini'}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">
                Password Baru <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Minimal 12 karakter baru"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isPasswordSubmitting}
                  className="pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground after:absolute after:-inset-2 sm:after:hidden touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={showNewPassword ? 'Sembunyikan password baru' : 'Tampilkan password baru'}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Gunakan minimal 12 karakter. Password baru harus berbeda dari password saat ini.
              </p>
            </div>

            {/* Confirm New Password */}
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">
                Konfirmasi Password Baru <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Ketik ulang password baru"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isPasswordSubmitting}
                  className="pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground after:absolute after:-inset-2 sm:after:hidden touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={showConfirmPassword ? 'Sembunyikan konfirmasi password baru' : 'Tampilkan konfirmasi password baru'}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Pastikan konfirmasi password sama dengan password baru di atas.
              </p>
            </div>
          </CardContent>

          <CardFooter className="border-t border-border pt-4">
            <Button
              type="submit"
              disabled={isPasswordSubmitting || !currentPassword || !newPassword || !confirmPassword}
              variant="default"
              size="standard"
              className="gap-1.5"
            >
              {isPasswordSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Mengubah password...</span>
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4" />
                  <span>Ganti Password</span>
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* 5. Section: Penyimpanan & Kuota Upload */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <HardDrive className="h-4 w-4" />
            <span>Penyimpanan & Kuota</span>
          </div>
          <CardTitle className="text-lg">Kapasitas Ruang & Batas Upload</CardTitle>
          <CardDescription>
            Informasi kapasitas ruang penyimpanan materi PDF dan batasan upload akun Anda.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {storageLoading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : storageUsage ? (
            <>
              {/* Storage Space Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">Kapasitas Penyimpanan</span>
                  <span className="text-muted-foreground text-xs font-mono">
                    {formatFileSize(storageUsage.usedBytes)} / {formatFileSize(storageUsage.limitBytes)} ({storageUsage.percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full transition-all ${
                      storageUsage.percentage >= 90
                        ? 'bg-destructive'
                        : storageUsage.percentage >= 70
                        ? 'bg-amber-500'
                        : 'bg-primary'
                    }`}
                    style={{ width: `${Math.min(100, storageUsage.percentage)}%` }}
                  />
                </div>
              </div>

              {/* Upload Limit Grid */}
              <div className="grid gap-3 sm:grid-cols-2 rounded-xl border border-border bg-muted/20 p-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <FileUp className="h-3.5 w-3.5 text-primary" />
                    Upload Hari Ini
                  </p>
                  <p className="text-lg font-bold text-foreground">
                    {storageUsage.dailyUploadsCount} / {storageUsage.dailyUploadsLimit} file
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Sisa kuota: {Math.max(0, storageUsage.dailyUploadsLimit - storageUsage.dailyUploadsCount)} upload hari ini.
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 text-primary" />
                    Reset Kuota Harian
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    Pukul 00:00 UTC
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Reset otomatis setiap tengah malam UTC.
                  </p>
                </div>
              </div>

              {/* PDF Document Limits */}
              <div className="rounded-lg border border-border/70 bg-muted/10 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">Ketentuan File PDF:</p>
                <ul className="list-disc list-inside space-y-0.5 text-xs">
                  <li>Maksimal ukuran 20 MB per file PDF berbasis teks.</li>
                  <li>Maksimal 100 halaman per dokumen.</li>
                  <li>PDF hasil pemindaian gambar murni (scanned) belum didukung pada versi ini.</li>
                </ul>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Tidak dapat memuat informasi penyimpanan.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
