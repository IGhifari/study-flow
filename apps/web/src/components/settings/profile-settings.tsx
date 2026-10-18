'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Mail,
} from 'lucide-react';
import {
  UpdateProfileInput,
  UpdateProfileInputSchema,
  UserProfile,
  TIMEZONE_OPTIONS,
} from '@studyflow/shared';
import {
  apiUpdateProfile,
  apiRequestEmailVerification,
} from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
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

export interface ProfileSettingsProps {
  user: UserProfile;
  onUserUpdated: (user: UserProfile) => void;
}

export function ProfileSettings({ user, onUserUpdated }: ProfileSettingsProps): React.JSX.Element {
  const router = useRouter();

  const [name, setName] = React.useState(user.name);
  const [timezone, setTimezone] = React.useState(user.timezone || 'Asia/Jakarta');
  const [isProfileSubmitting, setIsProfileSubmitting] = React.useState(false);
  const [profileSuccess, setProfileSuccess] = React.useState<string | null>(null);
  const [profileError, setProfileError] = React.useState<string | null>(null);

  // Email verification state & cooldown
  const [isVerifyingSubmitting, setIsVerifyingSubmitting] = React.useState(false);
  const [verifyAlert, setVerifyAlert] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [verifyCooldown, setVerifyCooldown] = React.useState(0);

  React.useEffect(() => {
    setName(user.name);
    setTimezone(user.timezone || 'Asia/Jakarta');
  }, [user.name, user.timezone]);

  React.useEffect(() => {
    if (verifyCooldown <= 0) return;
    const timer = setInterval(() => {
      setVerifyCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [verifyCooldown]);

  const isProfileDirty = React.useMemo(() => {
    return name.trim() !== user.name || timezone !== user.timezone;
  }, [user.name, user.timezone, name, timezone]);

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
      onUserUpdated(updated);
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

  return (
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
              {user.emailVerifiedAt ? (
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
                value={user.email || ''}
                disabled
                readOnly
                aria-readonly="true"
                className="bg-muted/50 cursor-not-allowed text-muted-foreground font-mono text-sm flex-1"
              />
              {!user.emailVerifiedAt && (
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
              Email terikat permanen dengan akun StudyFlow Anda. {user.emailVerifiedAt ? 'Alamat email ini telah terverifikasi.' : 'Verifikasi email membantu mengamankan akses akun dan pemulihan kata sandi.'}
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
  );
}
