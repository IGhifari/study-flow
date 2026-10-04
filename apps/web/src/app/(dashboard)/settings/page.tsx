'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
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
} from 'lucide-react';
import {
  UpdateProfileInput,
  UpdateProfileInputSchema,
  ChangePasswordInput,
  ChangePasswordInputSchema,
  formatFileSize,
  StorageUsageResponse,
} from '@studyflow/shared';
import { apiUpdateProfile, apiChangePassword, getCurrentUser } from '@/lib/auth-client';
import { getStorageUsage } from '@/lib/material-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { ThemeToggle } from '@/components/theme-toggle';

const COMMON_TIMEZONES = [
  { value: 'Asia/Jakarta', label: 'WIB — Asia/Jakarta (UTC+7)' },
  { value: 'Asia/Makassar', label: 'WITA — Asia/Makassar (UTC+8)' },
  { value: 'Asia/Jayapura', label: 'WIT — Asia/Jayapura (UTC+9)' },
  { value: 'UTC', label: 'UTC — Universal Time' },
];

export default function SettingsPage(): React.JSX.Element {
  const router = useRouter();

  // Profile Form State
  const [profileSuccess, setProfileSuccess] = React.useState<string | null>(null);
  const [profileError, setProfileError] = React.useState<string | null>(null);
  const [initialLoading, setInitialLoading] = React.useState(true);

  // Password Form State
  const [passwordSuccess, setPasswordSuccess] = React.useState<string | null>(null);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);

  // Storage usage state
  const [storageUsage, setStorageUsage] = React.useState<StorageUsageResponse | null>(null);
  const [storageLoading, setStorageLoading] = React.useState(true);

  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    setValue: setProfileValue,
    formState: { errors: profileErrors, isSubmitting: isProfileSubmitting },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(UpdateProfileInputSchema),
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPasswordForm,
    formState: { errors: passwordErrors, isSubmitting: isPasswordSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(ChangePasswordInputSchema),
  });

  React.useEffect(() => {
    async function loadData() {
      const user = await getCurrentUser();
      if (user) {
        setProfileValue('name', user.name);
        setProfileValue('timezone', user.timezone);
      }
      setInitialLoading(false);

      getStorageUsage()
        .then((data) => setStorageUsage(data))
        .catch((err) => console.error('Failed to load storage usage:', err))
        .finally(() => setStorageLoading(false));
    }
    loadData();
  }, [setProfileValue]);

  const onUpdateProfile = async (data: UpdateProfileInput) => {
    setProfileSuccess(null);
    setProfileError(null);
    try {
      const updated = await apiUpdateProfile(data);
      setProfileSuccess(`Profil berhasil diperbarui: ${updated.name}`);
      router.refresh();
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Gagal memperbarui profil');
    }
  };

  const onChangePassword = async (data: ChangePasswordInput) => {
    setPasswordSuccess(null);
    setPasswordError(null);
    try {
      const msg = await apiChangePassword(data);
      setPasswordSuccess(msg);
      resetPasswordForm();
      // Redirect to login after 1.5 seconds since change-password revokes all sessions
      setTimeout(() => {
        router.push('/login');
      }, 1500);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Gagal mengganti password');
    }
  };

  if (initialLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Pengaturan Akun
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kelola profil pribadi, preferensi tampilan, dan keamanan akunmu.
        </p>
      </div>

      {/* 1. Profile Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <User className="h-4 w-4" />
            <span>Informasi Profil</span>
          </div>
          <CardTitle>Profil Pengguna</CardTitle>
          <CardDescription>
            Ubah nama tampilan dan zona waktu yang digunakan untuk penjadwalan akademik.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleProfileSubmit(onUpdateProfile)} noValidate>
          <CardContent className="space-y-4">
            {profileSuccess && (
              <div
                role="status"
                className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{profileSuccess}</span>
              </div>
            )}

            {profileError && (
              <div
                role="alert"
                className="flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50/80 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                <span>{profileError}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="profile-name">Nama Lengkap</Label>
              <Input
                id="profile-name"
                disabled={isProfileSubmitting}
                aria-invalid={!!profileErrors.name}
                {...registerProfile('name')}
              />
              {profileErrors.name && (
                <p className="text-xs text-danger-foreground">{profileErrors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-timezone">Zona Waktu</Label>
              <select
                id="profile-timezone"
                disabled={isProfileSubmitting}
                className="flex h-11 w-full rounded-lg border border-input bg-card px-3.5 py-2 text-base sm:text-sm text-foreground transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                {...registerProfile('timezone')}
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
              {profileErrors.timezone && (
                <p className="text-xs text-danger-foreground">
                  {profileErrors.timezone.message}
                </p>
              )}
            </div>
          </CardContent>

          <CardFooter>
            <Button type="submit" disabled={isProfileSubmitting} className="font-semibold">
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

      {/* 2. Theme & Appearance */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <Palette className="h-4 w-4" />
            <span>Tampilan</span>
          </div>
          <CardTitle>Tema Aplikasi</CardTitle>
          <CardDescription>
            Pilih tema tampilan yang nyaman untuk membaca materi dalam waktu lama. Pilihanmu akan disimpan secara otomatis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Mode Tampilan</p>
              <p className="text-xs text-muted-foreground">
                Mendukung tema Sistem otomatis, Terang (kertas bersih), dan Gelap (tinta lembut).
              </p>
            </div>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>

      {/* 3. Security & Password Change */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <KeyRound className="h-4 w-4" />
            <span>Keamanan</span>
          </div>
          <CardTitle>Ganti Password</CardTitle>
          <CardDescription>
            Perbarui password akun secara berkala. Mengganti password akan mencabut seluruh sesi login lama di semua perangkat.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handlePasswordSubmit(onChangePassword)} noValidate>
          <CardContent className="space-y-4">
            {passwordSuccess && (
              <div
                role="status"
                className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{passwordSuccess} Mengarahkan ke halaman login...</span>
              </div>
            )}

            {passwordError && (
              <div
                role="alert"
                className="flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50/80 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                <span>{passwordError}</span>
              </div>
            )}

            {/* Current Password */}
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Password Saat Ini</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Masukkan password saat ini"
                  disabled={isPasswordSubmitting}
                  className="pr-12"
                  aria-invalid={!!passwordErrors.currentPassword}
                  {...registerPassword('currentPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((prev) => !prev)}
                  className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                  aria-label={showCurrentPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordErrors.currentPassword && (
                <p className="text-xs text-danger-foreground">
                  {passwordErrors.currentPassword.message}
                </p>
              )}
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="newPassword">Password Baru</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Minimal 12 karakter baru"
                  disabled={isPasswordSubmitting}
                  className="pr-12"
                  aria-invalid={!!passwordErrors.newPassword}
                  {...registerPassword('newPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                  aria-label={showNewPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordErrors.newPassword && (
                <p className="text-xs text-danger-foreground">
                  {passwordErrors.newPassword.message}
                </p>
              )}
            </div>
          </CardContent>

          <CardFooter>
            <Button
              type="submit"
              disabled={isPasswordSubmitting}
              variant="default"
              className="font-semibold"
            >
              {isPasswordSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Mengubah...</span>
                </>
              ) : (
                'Ganti Password'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Storage and Upload Quota */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-primary" />
            <CardTitle>Penyimpanan & Kuota Upload</CardTitle>
          </div>
          <CardDescription>
            Informasi kapasitas ruang penyimpanan materi PDF dan batasan upload harian akun Anda.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
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
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full transition-all ${
                      storageUsage.percentage >= 90
                        ? 'bg-danger'
                        : storageUsage.percentage >= 70
                        ? 'bg-warning'
                        : 'bg-primary'
                    }`}
                    style={{ width: `${Math.min(100, storageUsage.percentage)}%` }}
                  />
                </div>
              </div>

              {/* Upload Limit Grid */}
              <div className="grid gap-3 sm:grid-cols-2 rounded-lg border border-border bg-muted/20 p-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <FileUp className="h-3.5 w-3.5 text-primary" />
                    Upload Hari Ini
                  </p>
                  <p className="text-lg font-bold text-foreground">
                    {storageUsage.dailyUploadsCount} / {storageUsage.dailyUploadsLimit} file
                  </p>
                  <p className="text-[11px] text-muted-foreground">
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
                  <p className="text-[11px] text-muted-foreground">
                    Reset otomatis setiap tengah malam UTC.
                  </p>
                </div>
              </div>

              {/* PDF Document Limits */}
              <div className="rounded-md border border-border/80 bg-muted/10 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground text-xs">Aturan File PDF:</p>
                <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                  <li>Maksimal ukuran 20 MB per file PDF berbasis teks.</li>
                  <li>Maksimal 100 halaman per dokumen.</li>
                  <li>PDF hasil pemindaian gambar (scanned/tanpa teks) tidak didukung pada versi ini.</li>
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
