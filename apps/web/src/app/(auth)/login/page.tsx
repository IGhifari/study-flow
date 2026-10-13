'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { LoginInput, LoginInputSchema } from '@studyflow/shared';
import { apiLogin, getSafeReturnUrl, isApiError } from '@/lib/auth-client';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { TurnstileWidget, TurnstileWidgetHandle } from '@/components/auth/turnstile-widget';
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
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

function LoginForm(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');
  const isRegisteredSuccess = searchParams.get('registered') === 'true';
  const urlError = searchParams.get('error');

  const [showPassword, setShowPassword] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(urlError);
  const [requireCaptcha, setRequireCaptcha] = React.useState(false);
  const [turnstileToken, setTurnstileToken] = React.useState<string>('');
  const turnstileRef = React.useRef<TurnstileWidgetHandle>(null);

  React.useEffect(() => {
    if (urlError) {
      setServerError(urlError);
    }
  }, [urlError]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginInputSchema),
    defaultValues: {
      email: '',
      password: '',
      turnstileToken: '',
    },
  });

  const handleTurnstileVerify = (token: string) => {
    setTurnstileToken(token);
    setValue('turnstileToken', token, { shouldValidate: true });
    setServerError(null);
  };

  const handleTurnstileExpire = () => {
    setTurnstileToken('');
    setValue('turnstileToken', '', { shouldValidate: true });
  };

  const onSubmit = async (data: LoginInput) => {
    setServerError(null);
    try {
      await apiLogin(data);
      const safeTarget = getSafeReturnUrl(returnUrl, '/dashboard');
      router.push(safeTarget);
      router.refresh();
    } catch (err: unknown) {
      setServerError(
        err instanceof Error ? err.message : 'Terjadi kesalahan saat masuk. Silakan coba lagi.'
      );

      // Adaptive CAPTCHA: backend signals when verification is needed for the next attempt
      if (isApiError(err)) {
        if (err.details?.requireCaptcha === true || err.code === 'TURNSTILE_TOKEN_REQUIRED') {
          setRequireCaptcha(true);
        }
      }

      // Token Turnstile sekali pakai: reset widget setelah submit gagal
      setTurnstileToken('');
      setValue('turnstileToken', '');
      turnstileRef.current?.reset();
    }
  };

  return (
    <Card className="w-full border-border bg-card shadow-xs">
      <CardHeader className="space-y-1.5 pb-4">
        <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          Masuk ke StudyFlow
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Masukkan email dan password atau lanjutkan dengan akun Google Anda.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-4 pt-0">
          {/* Registration Success Banner */}
          {isRegisteredSuccess && (
            <Alert className="border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <AlertTitle className="text-sm font-semibold">Pendaftaran Berhasil</AlertTitle>
              <AlertDescription className="text-xs">
                Akun berhasil dibuat. Silakan masuk menggunakan akun baru Anda.
              </AlertDescription>
            </Alert>
          )}

          {/* Server Error Alert */}
          {serverError && (
            <Alert variant="destructive" role="alert" aria-live="polite">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="text-sm font-semibold">Gagal Masuk</AlertTitle>
              <AlertDescription className="text-xs break-words">{serverError}</AlertDescription>
            </Alert>
          )}

          {/* Google Sign-In Button */}
          <div className="space-y-3">
            <GoogleSignInButton returnUrl={returnUrl} disabled={isSubmitting} />
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <Separator />
              </div>
              <span className="relative bg-card px-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                atau dengan email
              </span>
            </div>
          </div>

          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs font-semibold text-foreground">
              Alamat Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="nama@kampus.ac.id"
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'email-error' : undefined}
              className="h-10 text-sm"
              {...register('email')}
            />
            {errors.email && (
              <p id="email-error" className="text-xs font-medium text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password Field with Accessible Toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-xs font-semibold text-foreground">
                Password
              </Label>
              <Link
                href="/forgot-password"
                className="text-xs text-primary hover:underline font-medium"
              >
                Lupa password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Masukkan password akun"
                disabled={isSubmitting}
                className="h-10 pr-11 text-sm"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'password-error' : undefined}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-1 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground after:absolute after:-inset-2 sm:after:hidden touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
            {errors.password && (
              <p id="password-error" className="text-xs font-medium text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Adaptive Cloudflare Turnstile: tampil setelah beberapa percobaan gagal */}
          {requireCaptcha && (
            <div className="space-y-1.5 pt-1">
              <p className="text-center text-[11px] text-muted-foreground">
                Selesaikan verifikasi keamanan untuk melanjutkan.
              </p>
              <TurnstileWidget
                ref={turnstileRef}
                action="login"
                onVerify={handleTurnstileVerify}
                onExpire={handleTurnstileExpire}
                onError={(err) => setServerError(err || 'Verifikasi keamanan gagal. Silakan coba lagi.')}
              />
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col space-y-4 pt-2">
          <Button
            type="submit"
            className="w-full h-10 font-semibold gap-2"
            disabled={isSubmitting || (requireCaptcha && !turnstileToken)}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
                <span>Memproses...</span>
              </>
            ) : (
              'Masuk'
            )}
          </Button>

          <Separator className="my-1" />

          <p className="text-center text-xs sm:text-sm text-muted-foreground">
            Belum punya akun?{' '}
            <Link
              href={returnUrl ? `/register?returnUrl=${encodeURIComponent(returnUrl)}` : '/register'}
              className="font-medium text-primary underline underline-offset-4 hover:opacity-80 transition-opacity"
            >
              Daftar sekarang
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function LoginPage(): React.JSX.Element {
  return (
    <React.Suspense
      fallback={
        <Card className="w-full">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">Masuk ke StudyFlow</CardTitle>
            <CardDescription>Memuat formulir masuk...</CardDescription>
          </CardHeader>
          <CardContent className="h-48 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      }
    >
      <LoginForm />
    </React.Suspense>
  );
}
