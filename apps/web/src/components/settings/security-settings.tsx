'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  KeyRound,
  Link2,
  Info,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import {
  UserProfile,
  ChangePasswordInput,
  ChangePasswordFormSchema,
  GoogleLinkInitInputSchema,
} from '@studyflow/shared';
import {
  apiChangePassword,
  initiateGoogleLink,
} from '@/lib/auth-client';
import { GoogleLogo } from '@/components/auth/google-sign-in-button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export interface SecuritySettingsProps {
  user: UserProfile;
  isGoogleConfigured: boolean | null;
}

export function SecuritySettings({ user, isGoogleConfigured }: SecuritySettingsProps): React.JSX.Element {
  const router = useRouter();

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

  // Google Linking Modal State
  const [isLinkModalOpen, setIsLinkModalOpen] = React.useState(false);
  const [linkPassword, setLinkPassword] = React.useState('');
  const [showLinkPassword, setShowLinkPassword] = React.useState(false);
  const [isLinkingSubmitting, setIsLinkingSubmitting] = React.useState(false);
  const [linkModalError, setLinkModalError] = React.useState<string | null>(null);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    const parseResult = ChangePasswordFormSchema.safeParse({
      currentPassword,
      newPassword,
      confirmPassword,
    });

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Input password tidak valid';
      setPasswordError(firstError);
      return;
    }

    setIsPasswordSubmitting(true);
    try {
      const payload: ChangePasswordInput = {
        currentPassword: parseResult.data.currentPassword,
        newPassword: parseResult.data.newPassword,
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

  const handleOpenLinkModal = () => {
    setLinkPassword('');
    setLinkModalError(null);
    setShowLinkPassword(false);
    setIsLinkModalOpen(true);
  };

  const handleConfirmLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const parseResult = GoogleLinkInitInputSchema.safeParse({
      currentPassword: linkPassword,
    });

    if (!parseResult.success) {
      setLinkModalError(parseResult.error.issues[0]?.message || 'Password saat ini wajib diisi.');
      return;
    }

    setIsLinkingSubmitting(true);
    setLinkModalError(null);
    try {
      const { url } = await initiateGoogleLink(parseResult.data.currentPassword);
      window.location.assign(url);
    } catch (err: any) {
      setLinkModalError(err.message || 'Gagal memulai pengaitan akun Google.');
      setIsLinkingSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Akun Terhubung */}
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
                  {user.providers?.includes('google') ? (
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
                  {user.providers?.includes('google')
                    ? `Terhubung sebagai ${user.email}. Anda dapat masuk ke StudyFlow langsung menggunakan akun Google ini.`
                    : `Tautkan akun Google Anda (${user.email}) untuk masuk dengan cepat dan aman.`}
                </p>
                {!user.providers?.includes('google') && !isGoogleConfigured && isGoogleConfigured !== null && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Integrasi Google OAuth belum diaktifkan pada konfigurasi server.
                  </p>
                )}
              </div>
            </div>

            {!user.providers?.includes('google') && isGoogleConfigured && user.hasPassword && (
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

      {/* 2. Keamanan Akun */}
      {!user.hasPassword ? (
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
                Akun ini terdaftar dan diautentikasi secara langsung menggunakan Akun Google (<strong>{user.email}</strong>). Akun Anda tidak memiliki password lokal StudyFlow, sehingga formulir ganti password tidak diperlukan.
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

      {/* Dialog Re-autentikasi untuk Hubungkan Akun Google */}
      <Dialog open={isLinkModalOpen} onOpenChange={setIsLinkModalOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GoogleLogo className="h-5 w-5" />
              <span>Hubungkan Akun Google</span>
            </DialogTitle>
            <DialogDescription>
              Demi keamanan, masukkan password akun StudyFlow Anda saat ini untuk mengonfirmasi pengaitan ke akun Google ({user.email}).
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
    </div>
  );
}
