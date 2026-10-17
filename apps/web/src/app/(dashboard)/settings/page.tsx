'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  ShieldCheck,
  Link2,
  Mail,
  Bell,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  UpdateProfileInput,
  UpdateProfileInputSchema,
  ChangePasswordInput,
  formatFileSize,
  StorageUsageResponse,
  UserProfile,
} from '@studyflow/shared';
import {
  apiUpdateProfile,
  apiChangePassword,
  getCurrentUser,
  getGoogleAuthStatus,
  initiateGoogleLink,
  apiRequestEmailVerification,
} from '@/lib/auth-client';
import { getStorageUsage } from '@/lib/material-client';
import { GoogleLogo } from '@/components/auth/google-sign-in-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Progress } from '@/components/ui/progress';
import { FadeIn, StaggerGroup, StaggerItem } from '@/components/ui/motion';
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

function SettingsContent(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();

  // User & Profile State
  const [currentUser, setCurrentUser] = React.useState<UserProfile | null>(null);
  const [name, setName] = React.useState('');
  const [timezone, setTimezone] = React.useState('Asia/Jakarta');
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [isProfileSubmitting, setIsProfileSubmitting] = React.useState(false);
  const [profileSuccess, setProfileSuccess] = React.useState<string | null>(null);
  const [profileError, setProfileError] = React.useState<string | null>(null);

  // Google OAuth & Linking State
  const [isGoogleConfigured, setIsGoogleConfigured] = React.useState<boolean | null>(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = React.useState(false);
  const [linkPassword, setLinkPassword] = React.useState('');
  const [showLinkPassword, setShowLinkPassword] = React.useState(false);
  const [isLinkingSubmitting, setIsLinkingSubmitting] = React.useState(false);
  const [linkModalError, setLinkModalError] = React.useState<string | null>(null);
  const [googleAlert, setGoogleAlert] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  // Email Verification State & Cooldown
  const [isVerifyingSubmitting, setIsVerifyingSubmitting] = React.useState(false);
  const [verifyAlert, setVerifyAlert] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [verifyCooldown, setVerifyCooldown] = React.useState(0);

  // Email Deadline Reminder Preference State
  const [reminderEmailDeadline, setReminderEmailDeadline] = React.useState(false);
  const [isReminderSubmitting, setIsReminderSubmitting] = React.useState(false);
  const [reminderAlert, setReminderAlert] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null);

  React.useEffect(() => {
    if (verifyCooldown <= 0) return;
    const timer = setInterval(() => {
      setVerifyCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [verifyCooldown]);

  const handleSendVerificationEmail = async () => {
    setIsVerifyingSubmitting(true);
    setVerifyAlert(null);
    try {
      const res = await apiRequestEmailVerification();
      setVerifyAlert({ type: 'success', message: res.message });
      setVerifyCooldown(60); // 60s cooldown
    } catch (err: any) {
      setVerifyAlert({
        type: 'error',
        message: err.message || 'Gagal mengirimkan email verifikasi. Silakan coba lagi.',
      });
    } finally {
      setIsVerifyingSubmitting(false);
    }
  };

  const handleToggleReminder = async (newVal: boolean) => {
    if (isReminderSubmitting) return;

    if (newVal && !currentUser?.emailVerifiedAt) {
      setReminderAlert({
        type: 'error',
        message: 'Alamat email harus diverifikasi terlebih dahulu sebelum mengaktifkan pengingat deadline.',
      });
      return;
    }

    setIsReminderSubmitting(true);
    setReminderAlert(null);

    try {
      const updated = await apiUpdateProfile({ reminderEmailDeadline: newVal });
      setCurrentUser(updated);
      setReminderEmailDeadline(Boolean(updated.reminderEmailDeadline));
      setReminderAlert({
        type: 'success',
        message: newVal
          ? 'Pengingat deadline via email berhasil diaktifkan. Anda akan menerima notifikasi sekitar 24 jam sebelum deadline tugas.'
          : 'Pengingat deadline via email berhasil dinonaktifkan.',
      });
    } catch (err: any) {
      setReminderAlert({
        type: 'error',
        message: err.message || 'Gagal mengubah preferensi pengingat deadline.',
      });
      setReminderEmailDeadline(Boolean(currentUser?.reminderEmailDeadline));
    } finally {
      setIsReminderSubmitting(false);
    }
  };

  // Check URL search parameters for Google Linking outcome
  React.useEffect(() => {
    const googleStatus = searchParams.get('google');
    const urlError = searchParams.get('error');

    if (googleStatus === 'linked') {
      setGoogleAlert({
        type: 'success',
        message: 'Akun Google berhasil dihubungkan ke akun StudyFlow Anda.',
      });
    } else if (urlError) {
      setGoogleAlert({
        type: 'error',
        message: urlError,
      });
    }
  }, [searchParams]);

  // Load User Data, Storage, & Google Auth Status on Mount
  React.useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const user = await getCurrentUser();
        if (isMounted && user) {
          setCurrentUser(user);
          setName(user.name);
          setTimezone(user.timezone || 'Asia/Jakarta');
          setReminderEmailDeadline(Boolean(user.reminderEmailDeadline));
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

      try {
        const configured = await getGoogleAuthStatus();
        if (isMounted) setIsGoogleConfigured(configured);
      } catch {
        if (isMounted) setIsGoogleConfigured(false);
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

  // Google Linking Handlers
  const handleOpenLinkModal = () => {
    setLinkPassword('');
    setLinkModalError(null);
    setShowLinkPassword(false);
    setIsLinkModalOpen(true);
  };

  const handleConfirmLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkPassword) {
      setLinkModalError('Password saat ini wajib diisi.');
      return;
    }

    setIsLinkingSubmitting(true);
    setLinkModalError(null);
    try {
      const { url } = await initiateGoogleLink(linkPassword);
      window.location.assign(url);
    } catch (err: any) {
      setLinkModalError(err.message || 'Gagal memulai pengaitan akun Google.');
      setIsLinkingSubmitting(false);
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
    <FadeIn className="space-y-6 max-w-3xl">
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

      {/* Alert Status Pengaitan Google */}
      {googleAlert && (
        <Alert
          variant={googleAlert.type === 'success' ? 'default' : 'destructive'}
          className={
            googleAlert.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300'
              : ''
          }
        >
          {googleAlert.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertTitle className="font-semibold text-sm">
            {googleAlert.type === 'success' ? 'Pengaitan Akun Berhasil' : 'Gagal Menghubungkan Akun'}
          </AlertTitle>
          <AlertDescription className="text-xs sm:text-sm">{googleAlert.message}</AlertDescription>
        </Alert>
      )}

      <StaggerGroup className="space-y-6">
        {/* 2. Section: Profil Pengguna & Zona Waktu */}
        <StaggerItem>
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

                {/* Email & Status Verifikasi */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="profile-email">Alamat Email</Label>
                    {currentUser?.emailVerifiedAt ? (
                      <Badge variant="outline" className="border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 text-xs gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Terverifikasi
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400 text-xs gap-1">
                        <AlertCircle className="h-3 w-3" /> Belum Terverifikasi
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      id="profile-email"
                      value={currentUser?.email || ''}
                      disabled
                      readOnly
                      aria-readonly="true"
                      className="bg-muted/50 cursor-not-allowed text-muted-foreground font-mono text-sm flex-1"
                    />
                    {!currentUser?.emailVerifiedAt && (
                      <Button
                        type="button"
                        variant="outline"
                        size="standard"
                        onClick={handleSendVerificationEmail}
                        disabled={isVerifyingSubmitting || verifyCooldown > 0}
                        className="shrink-0 gap-1.5"
                      >
                        {isVerifyingSubmitting ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Mengirim...</span>
                          </>
                        ) : verifyCooldown > 0 ? (
                          <>
                            <Clock className="h-3.5 w-3.5" />
                            <span className="tabular-nums">Kirim ulang ({verifyCooldown}s)</span>
                          </>
                        ) : (
                          <>
                            <Mail className="h-3.5 w-3.5" />
                            <span>Kirim email verifikasi</span>
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                  {verifyAlert && (
                    <Alert
                      variant={verifyAlert.type === 'success' ? 'default' : 'destructive'}
                      className={
                        verifyAlert.type === 'success'
                          ? 'border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300 py-2 text-xs'
                          : 'py-2 text-xs'
                      }
                    >
                      {verifyAlert.type === 'success' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5" />
                      )}
                      <AlertDescription>{verifyAlert.message}</AlertDescription>
                    </Alert>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Email terikat permanen dengan akun StudyFlow Anda. {currentUser?.emailVerifiedAt ? 'Alamat email ini telah terverifikasi.' : 'Verifikasi email membantu mengamankan akses akun dan pemulihan kata sandi.'}
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
        </StaggerItem>

        {/* 2. Section: Pengingat & Notifikasi Email */}
        <StaggerItem>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <Bell className="h-4 w-4" />
                <span>Notifikasi & Pengingat</span>
              </div>
              <CardTitle className="text-lg">Pengingat Deadline Tugas</CardTitle>
              <CardDescription>
                Atur pengingat tenggat waktu tugas yang dikirimkan langsung ke kotak masuk email Anda.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Target Alamat Email */}
              <div className="rounded-xl border border-border p-4 bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Alamat Email Pengiriman</Label>
                  {currentUser?.emailVerifiedAt ? (
                    <Badge variant="outline" className="border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 text-xs gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Terverifikasi
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400 text-xs gap-1">
                      <AlertCircle className="h-3 w-3" /> Belum Terverifikasi
                    </Badge>
                  )}
                </div>
                <Input
                  value={currentUser?.email || ''}
                  disabled
                  readOnly
                  className="bg-muted/50 cursor-not-allowed font-mono text-sm text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  Pengingat dikirim ke alamat email resmi akun Anda.
                </p>
              </div>

              {/* Toggle Switch Pengingat H-1 */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-border p-4 bg-muted/20">
                <div className="space-y-1">
                  <Label htmlFor="reminder-switch" className="text-sm font-medium text-foreground cursor-pointer">
                    Pengingat deadline lewat email
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Pengingat dikirim sekitar 24 jam sebelum deadline untuk tugas yang belum selesai.
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center">
                  {isReminderSubmitting && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  <Switch
                    id="reminder-switch"
                    checked={reminderEmailDeadline}
                    onCheckedChange={handleToggleReminder}
                    disabled={isReminderSubmitting || !currentUser?.emailVerifiedAt}
                    aria-label="Pengingat deadline lewat email"
                  />
                </div>
              </div>

              {/* Warning bila email belum terverifikasi */}
              {!currentUser?.emailVerifiedAt && (
                <Alert className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300 text-xs py-3">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div className="space-y-2 flex-1">
                    <AlertTitle className="text-xs font-semibold">Verifikasi Email Diperlukan</AlertTitle>
                    <AlertDescription className="text-xs text-amber-800 dark:text-amber-300">
                      Hanya email yang telah diverifikasi yang dapat mengaktifkan pengingat deadline. Silakan verifikasi email Anda terlebih dahulu.
                    </AlertDescription>
                    <div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleSendVerificationEmail}
                        disabled={isVerifyingSubmitting || verifyCooldown > 0}
                        className="h-7 text-xs gap-1 border-amber-500/40 hover:bg-amber-100/50 dark:hover:bg-amber-900/40"
                      >
                        {isVerifyingSubmitting ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Mengirim...</span>
                          </>
                        ) : verifyCooldown > 0 ? (
                          <>
                            <Clock className="h-3 w-3" />
                            <span className="tabular-nums">Kirim ulang ({verifyCooldown}s)</span>
                          </>
                        ) : (
                          <>
                            <Mail className="h-3 w-3" />
                            <span>Kirim email verifikasi sekarang</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </Alert>
              )}

              {/* Feedback Alert */}
              {reminderAlert && (
                <Alert
                  variant={reminderAlert.type === 'success' ? 'default' : 'destructive'}
                  className={
                    reminderAlert.type === 'success'
                      ? 'border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300 py-2.5 text-xs'
                      : 'py-2.5 text-xs'
                  }
                >
                  {reminderAlert.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertDescription>{reminderAlert.message}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </StaggerItem>

        {/* 3. Section: Preferensi Tampilan */}
        <StaggerItem>
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
        </StaggerItem>

        {/* 4. Section: Akun Terhubung */}
        <StaggerItem>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <Link2 className="h-4 w-4" />
                <span>Akun Terhubung</span>
              </div>
              <CardTitle className="text-lg">Integrasi Layanan Pihak Ketiga</CardTitle>
              <CardDescription>
                Kelola integrasi login sosial yang terhubung ke akun StudyFlow Anda.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-border p-4 bg-muted/20">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background shadow-xs">
                    <GoogleLogo className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">Google</span>
                      {currentUser?.providers?.includes('google') ? (
                        <Badge variant="outline" className="border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 text-xs gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Terhubung
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Belum Terhubung
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {currentUser?.providers?.includes('google')
                        ? `Terhubung sebagai ${currentUser.email}. Anda dapat masuk ke StudyFlow langsung menggunakan akun Google ini.`
                        : `Tautkan akun Google Anda (${currentUser?.email}) untuk masuk dengan cepat dan aman.`}
                    </p>
                    {!currentUser?.providers?.includes('google') && !isGoogleConfigured && isGoogleConfigured !== null && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Integrasi Google OAuth belum diaktifkan pada konfigurasi server.
                      </p>
                    )}
                  </div>
                </div>

                {!currentUser?.providers?.includes('google') && isGoogleConfigured && currentUser?.hasPassword && (
                  <div className="shrink-0 self-start sm:self-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="standard"
                      onClick={handleOpenLinkModal}
                      className="gap-2"
                    >
                      <GoogleLogo className="h-4 w-4" />
                      <span>Hubungkan Google</span>
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </StaggerItem>

        {/* 5. Section: Keamanan Akun */}
        <StaggerItem>
          {!currentUser?.hasPassword ? (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Keamanan Akun</span>
                </div>
                <CardTitle className="text-lg">Metode Masuk Google</CardTitle>
                <CardDescription>
                  Informasi autentikasi dan pengaturan akses akun Anda.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 text-xs text-muted-foreground space-y-2">
                  <div className="flex items-center gap-2 font-medium text-sky-800 dark:text-sky-300 text-sm">
                    <Info className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
                    <span>Akun Menggunakan Autentikasi Google</span>
                  </div>
                  <p>
                    Akun ini terdaftar dan diautentikasi secara langsung menggunakan Akun Google (<strong>{currentUser?.email}</strong>). Akun Anda tidak memiliki password lokal StudyFlow, sehingga formulir ganti password tidak diperlukan.
                  </p>
                  <p>
                    Untuk menjaga keamanan akun Anda, kelola proteksi keamanan (verifikasi 2 langkah, kata sandi) langsung melalui pengaturan Akun Google Anda.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
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
          )}
        </StaggerItem>

        {/* 6. Section: Penyimpanan & Kuota Upload */}
        <StaggerItem>
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
                      <span className="text-muted-foreground text-xs font-mono tabular-nums">
                        {formatFileSize(storageUsage.usedBytes)} / {formatFileSize(storageUsage.limitBytes)} ({storageUsage.percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <Progress
                      value={Math.min(100, Math.round((storageUsage.usedBytes / storageUsage.limitBytes) * 100))}
                      className="h-2.5"
                    />
                  </div>

                  {/* Upload Limit Grid */}
                  <div className="grid gap-3 sm:grid-cols-2 rounded-xl border border-border bg-muted/20 p-4">
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <FileUp className="h-3.5 w-3.5 text-primary" />
                        Upload Hari Ini
                      </p>
                      <p className="text-lg font-bold text-foreground tabular-nums">
                        {storageUsage.dailyUploadsCount} / {storageUsage.dailyUploadsLimit} file
                      </p>
                      <Progress
                        value={
                          storageUsage.dailyUploadsLimit > 0
                            ? Math.min(100, Math.round((storageUsage.dailyUploadsCount / storageUsage.dailyUploadsLimit) * 100))
                            : 0
                        }
                        className="h-1.5"
                      />
                      <p className="text-xs text-muted-foreground tabular-nums">
                        Sisa kuota: {Math.max(0, storageUsage.dailyUploadsLimit - storageUsage.dailyUploadsCount)} upload hari ini.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Info className="h-3.5 w-3.5 text-primary" />
                        Reset Kuota Harian
                      </p>
                      <p className="text-sm font-semibold text-foreground tabular-nums">
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
        </StaggerItem>
      </StaggerGroup>

      {/* Dialog Re-autentikasi untuk Hubungkan Akun Google */}
      <Dialog open={isLinkModalOpen} onOpenChange={setIsLinkModalOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GoogleLogo className="h-5 w-5" />
              <span>Hubungkan Akun Google</span>
            </DialogTitle>
            <DialogDescription>
              Demi keamanan, masukkan password akun StudyFlow Anda saat ini untuk mengonfirmasi pengaitan ke akun Google ({currentUser?.email}).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmLink} className="space-y-4 pt-1" noValidate>
            {linkModalError && (
              <Alert variant="destructive" role="alert">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{linkModalError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="link-password">
                Password Saat Ini <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="link-password"
                  type={showLinkPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Masukkan password saat ini"
                  value={linkPassword}
                  onChange={(e) => setLinkPassword(e.target.value)}
                  disabled={isLinkingSubmitting}
                  className="pr-12"
                  autoFocus
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowLinkPassword((prev) => !prev)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground after:absolute after:-inset-2 sm:after:hidden touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={showLinkPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showLinkPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsLinkModalOpen(false)}
                disabled={isLinkingSubmitting}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={isLinkingSubmitting || !linkPassword}
                className="gap-2"
              >
                {isLinkingSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Menghubungkan...</span>
                  </>
                ) : (
                  <>
                    <GoogleLogo className="h-4 w-4" />
                    <span>Lanjutkan ke Google</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </FadeIn>
  );
}

function SettingsSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-96" />
      </div>
      <div className="space-y-6">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}

export default function SettingsPage(): React.JSX.Element {
  return (
    <React.Suspense fallback={<SettingsSkeleton />}>
      <SettingsContent />
    </React.Suspense>
  );
}
