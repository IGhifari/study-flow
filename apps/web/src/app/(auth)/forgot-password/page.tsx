'use client';

import * as React from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle, Mail, Info } from 'lucide-react';
import { ForgotPasswordInput, ForgotPasswordInputSchema } from '@studyflow/shared';
import { apiForgotPassword } from '@/lib/auth-client';
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

export default function ForgotPasswordPage(): React.JSX.Element {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(ForgotPasswordInputSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    setServerError(null);
    setSuccessMessage(null);
    try {
      const res = await apiForgotPassword(data.email);
      setSuccessMessage(res.message);
    } catch (err: any) {
      setServerError(err.message || 'Gagal mengirim permintaan reset kata sandi.');
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
          Lupa Kata Sandi
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Masukkan alamat email akun StudyFlow Anda untuk menerima tautan pengaturan ulang kata sandi.
        </CardDescription>
      </CardHeader>

      {successMessage ? (
        <CardContent className="space-y-4">
          <Alert
            variant="default"
            className="border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <AlertTitle className="font-semibold text-sm">Permintaan Dikirim</AlertTitle>
            <AlertDescription className="text-xs sm:text-sm">
              {successMessage}
            </AlertDescription>
          </Alert>

          <div className="rounded-lg border border-border bg-muted/20 p-4 text-xs text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">Langkah Selanjutnya:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Periksa kotak masuk (inbox) atau folder spam pada email Anda.</li>
              <li>Tautan reset hanya berlaku selama <strong>30 menit</strong> sejak dibuat.</li>
              <li>Jika email tidak kunjung tiba, pastikan Anda mendaftar dengan email dan password lokal.</li>
            </ul>
          </div>

          <div className="pt-2">
            <Link href="/login" className="block w-full">
              <Button variant="outline" className="w-full h-10 gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span>Kembali ke Halaman Masuk</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CardContent className="space-y-4">
            {serverError && (
              <Alert variant="destructive" role="alert">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs sm:text-sm break-words">
                  {serverError}
                </AlertDescription>
              </Alert>
            )}

            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-semibold text-foreground">
                Alamat Email
              </Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="nama@kampus.ac.id"
                  disabled={isSubmitting}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  className="h-10 text-sm pl-10"
                  {...register('email')}
                />
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
              {errors.email && (
                <p id="email-error" className="text-xs font-medium text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Google Notice */}
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground flex items-start gap-2.5">
              <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p>
                Daftar menggunakan Google? Anda tidak memiliki kata sandi lokal.{' '}
                <Link href="/login" className="text-primary font-semibold hover:underline">
                  Gunakan Lanjutkan dengan Google
                </Link>{' '}
                pada halaman masuk.
              </p>
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
                  <span>Mengirim tautan...</span>
                </>
              ) : (
                'Kirim Tautan Reset'
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
      )}
    </Card>
  );
}
