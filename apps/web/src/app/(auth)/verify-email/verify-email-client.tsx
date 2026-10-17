'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  MailCheck,
  ShieldCheck,
  LayoutDashboard,
  LogIn,
} from 'lucide-react';
import { apiConfirmEmailVerification, getCurrentUser } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { FadeIn } from '@/components/ui/motion';

function VerifyEmailForm(): React.JSX.Element {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = React.useState<boolean | null>(null);

  // Check login status on mount to customize navigation buttons
  React.useEffect(() => {
    let isMounted = true;
    getCurrentUser()
      .then((user) => {
        if (isMounted) setIsLoggedIn(Boolean(user));
      })
      .catch(() => {
        if (isMounted) setIsLoggedIn(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleConfirmVerification = async () => {
    if (!token) {
      setServerError('Token verifikasi tidak ditemukan dalam tautan.');
      return;
    }

    setIsSubmitting(true);
    setServerError(null);

    try {
      const res = await apiConfirmEmailVerification(token);
      setSuccessMessage(res.message || 'Alamat email berhasil diverifikasi!');

      // Notify other components if logged in
      if (typeof window !== 'undefined' && res.user) {
        window.dispatchEvent(
          new CustomEvent('studyflow:profile-updated', { detail: res.user })
        );
      }
    } catch (err: any) {
      setServerError(
        err.message || 'Tautan verifikasi tidak valid atau telah kedaluwarsa. Silakan minta tautan baru.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FadeIn className="w-full">
      <Card className="w-full border-border bg-card shadow-xs">
        <CardHeader className="space-y-1.5 pb-4">
          <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
            <ShieldCheck className="h-4 w-4" />
            <span>Keamanan Akun</span>
          </div>
          <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Verifikasi Alamat Email
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Konfirmasikan kepemilikan alamat email akun StudyFlow Anda.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          {/* Success State */}
          {successMessage ? (
            <div className="space-y-4">
              <Alert className="border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <AlertTitle className="text-sm font-semibold">Verifikasi Berhasil</AlertTitle>
                <AlertDescription className="text-xs sm:text-sm mt-1">
                  {successMessage} Alamat email akun Anda kini telah terverifikasi resmi.
                </AlertDescription>
              </Alert>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                {isLoggedIn ? (
                  <Button asChild className="w-full gap-2">
                    <Link href="/dashboard">
                      <LayoutDashboard className="h-4 w-4" />
                      <span>Kembali ke Dashboard</span>
                    </Link>
                  </Button>
                ) : (
                  <Button asChild className="w-full gap-2">
                    <Link href="/login">
                      <LogIn className="h-4 w-4" />
                      <span>Masuk ke Akun Anda</span>
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          ) : !token ? (
            /* Missing Token State */
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-5 w-5" />
                <AlertTitle className="text-sm font-semibold">Tautan Tidak Lengkap</AlertTitle>
                <AlertDescription className="text-xs sm:text-sm mt-1">
                  Tautan verifikasi tidak memiliki parameter token. Pastikan Anda membuka tautan lengkap yang dikirimkan ke email Anda.
                </AlertDescription>
              </Alert>

              <div className="pt-2 flex flex-col gap-2">
                <Button asChild variant="outline" className="w-full gap-2">
                  <Link href={isLoggedIn ? '/settings' : '/login'}>
                    <ArrowLeft className="h-4 w-4" />
                    <span>{isLoggedIn ? 'Kembali ke Pengaturan' : 'Kembali ke Halaman Masuk'}</span>
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            /* Ready to Confirm State */
            <div className="space-y-4">
              {serverError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-5 w-5" />
                  <AlertTitle className="text-sm font-semibold">Verifikasi Gagal</AlertTitle>
                  <AlertDescription className="text-xs sm:text-sm mt-1">
                    {serverError}
                  </AlertDescription>
                </Alert>
              )}

              <div className="rounded-xl border border-border bg-muted/20 p-4 text-xs sm:text-sm text-muted-foreground space-y-2">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <MailCheck className="h-4 w-4 text-primary shrink-0" />
                  <span>Konfirmasi Verifikasi Email</span>
                </div>
                <p>
                  Klik tombol di bawah ini untuk memverifikasi alamat email akun Anda. Proses ini akan mengikat status terverifikasi secara permanen tanpa mengganti password atau mengganggu sesi yang sedang aktif.
                </p>
              </div>

              <Button
                type="button"
                onClick={handleConfirmVerification}
                disabled={isSubmitting}
                className="w-full h-10 font-semibold gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    <span>Memverifikasi Email...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>Konfirmasi Verifikasi Email</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col space-y-3 pt-0 border-t border-border mt-2">
          <div className="flex items-center justify-between w-full pt-3 text-xs text-muted-foreground">
            <Link
              href={isLoggedIn ? '/dashboard' : '/login'}
              className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors font-medium"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>{isLoggedIn ? 'Kembali ke Dashboard' : 'Kembali ke Halaman Masuk'}</span>
            </Link>
            {isLoggedIn && (
              <Link
                href="/settings"
                className="hover:text-foreground transition-colors font-medium"
              >
                Pengaturan Akun
              </Link>
            )}
          </div>
        </CardFooter>
      </Card>
    </FadeIn>
  );
}

export default function VerifyEmailClient(): React.JSX.Element {
  return (
    <React.Suspense
      fallback={
        <Card className="w-full border-border bg-card shadow-xs">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Memuat Verifikasi...</CardTitle>
            <CardDescription>Menyiapkan token verifikasi...</CardDescription>
          </CardHeader>
          <CardContent className="h-32 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      }
    >
      <VerifyEmailForm />
    </React.Suspense>
  );
}
