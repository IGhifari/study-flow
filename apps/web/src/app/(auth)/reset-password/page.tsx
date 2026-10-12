'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  ShieldAlert,
} from 'lucide-react';
import { apiResetPassword } from '@/lib/auth-client';
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

const ResetPasswordFormSchema = z
  .object({
    newPassword: z
      .string()
      .min(12, 'Kata sandi baru minimal 12 karakter (disarankan kombinasi kata/passphrase)')
      .max(128, 'Kata sandi baru maksimal 128 karakter'),
    confirmPassword: z.string().min(1, 'Konfirmasi kata sandi wajib diisi'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Konfirmasi kata sandi tidak cocok dengan kata sandi baru',
    path: ['confirmPassword'],
  });

type ResetPasswordFormValues = z.infer<typeof ResetPasswordFormSchema>;

function ResetPasswordForm(): React.JSX.Element {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [serverError, setServerError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(ResetPasswordFormSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: ResetPasswordFormValues) => {
    setServerError(null);
    setSuccessMessage(null);

    if (!token || token.trim().length < 32) {
      setServerError('Token reset tidak valid atau tidak ditemukan pada URL.');
      return;
    }

    try {
      const res = await apiResetPassword(token.trim(), data.newPassword);
      setSuccessMessage(
        res.message || 'Kata sandi Anda berhasil diperbarui. Silakan masuk menggunakan kata sandi baru.'
      );
    } catch (err: any) {
      setServerError(
        err.message || 'Tautan reset tidak valid atau telah kedaluwarsa. Silakan minta tautan baru.'
      );
    }
  };

  // If token is completely missing from query string
  if (!token) {
    return (
      <Card className="w-full">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 text-destructive mb-1">
            <ShieldAlert className="h-6 w-6" />
            <CardTitle className="text-xl font-bold tracking-tight">
              Tautan Tidak Valid
            </CardTitle>
          </div>
          <CardDescription className="text-sm text-muted-foreground">
            Tautan pengaturan ulang kata sandi tidak lengkap atau token verifikasi tidak ditemukan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs sm:text-sm">
              Pastikan Anda menyalin URL secara lengkap dari email atau ajukan permintaan baru jika tautan sebelumnya terpotong.
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Link href="/forgot-password" className="block w-full">
            <Button className="w-full h-10">Minta Tautan Baru</Button>
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Kembali ke Halaman Masuk</span>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  // Success state
  if (successMessage) {
    return (
      <Card className="w-full">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
            <CheckCircle2 className="h-6 w-6" />
            <CardTitle className="text-xl font-bold tracking-tight text-foreground">
              Kata Sandi Diperbarui
            </CardTitle>
          </div>
          <CardDescription className="text-sm text-muted-foreground">
            {successMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border border-border bg-muted/20 p-4 text-xs text-muted-foreground space-y-1.5">
            <p className="font-semibold text-foreground">Sesi lama dinonaktifkan:</p>
            <p>
              Seluruh sesi login sebelumnya di perangkat lain telah dicabut demi keamanan akun Anda.
            </p>
          </div>
        </CardContent>
        <CardFooter className="pt-2">
          <Link href="/login" className="block w-full">
            <Button className="w-full h-10 font-semibold">
              Masuk Sekarang
            </Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <KeyRound className="h-4 w-4" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            Atur Kata Sandi Baru
          </CardTitle>
        </div>
        <CardDescription className="text-sm text-muted-foreground">
          Masukkan kata sandi baru untuk akun Anda. Minimal 12 karakter.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-4">
          {serverError && (
            <Alert variant="destructive" role="alert" className="space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <AlertDescription className="text-xs sm:text-sm break-words">
                  {serverError}
                </AlertDescription>
              </div>
              <div className="pt-1">
                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold underline hover:opacity-90 inline-block"
                >
                  Minta tautan reset baru &rarr;
                </Link>
              </div>
            </Alert>
          )}

          {/* New Password Field */}
          <div className="space-y-2">
            <Label htmlFor="newPassword" className="text-xs font-semibold text-foreground">
              Kata Sandi Baru
            </Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Minimal 12 karakter"
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.newPassword)}
                aria-describedby={errors.newPassword ? 'new-password-error' : undefined}
                className="h-10 text-sm pl-10 pr-10"
                {...register('newPassword')}
              />
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={isSubmitting}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-sm focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.newPassword && (
              <p id="new-password-error" className="text-xs font-medium text-destructive">
                {errors.newPassword.message}
              </p>
            )}
          </div>

          {/* Confirm Password Field */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-xs font-semibold text-foreground">
              Konfirmasi Kata Sandi Baru
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Ulangi kata sandi baru"
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.confirmPassword)}
                aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
                className="h-10 text-sm pl-10 pr-10"
                {...register('confirmPassword')}
              />
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                disabled={isSubmitting}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-sm focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={
                  showConfirmPassword
                    ? 'Sembunyikan konfirmasi kata sandi'
                    : 'Tampilkan konfirmasi kata sandi'
                }
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p id="confirm-password-error" className="text-xs font-medium text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-10 font-semibold"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span>Menyimpan kata sandi...</span>
              </>
            ) : (
              'Simpan Kata Sandi Baru'
            )}
          </Button>

          <div className="text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Batal dan kembali ke Masuk</span>
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function ResetPasswordPage(): React.JSX.Element {
  return (
    <React.Suspense
      fallback={
        <Card className="w-full">
          <CardHeader className="space-y-2">
            <div className="h-6 w-48 bg-muted rounded-md animate-pulse" />
            <div className="h-4 w-64 bg-muted rounded-md animate-pulse" />
          </CardHeader>
          <CardContent className="py-8 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      }
    >
      <ResetPasswordForm />
    </React.Suspense>
  );
}
