'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { RegisterFormInput, RegisterInput, RegisterInputSchema } from '@studyflow/shared';
import { apiRegister } from '@/lib/auth-client';
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

const COMMON_TIMEZONES = [
  { value: 'Asia/Jakarta', label: 'WIB — Asia/Jakarta (UTC+7)' },
  { value: 'Asia/Makassar', label: 'WITA — Asia/Makassar (UTC+8)' },
  { value: 'Asia/Jayapura', label: 'WIT — Asia/Jayapura (UTC+9)' },
  { value: 'UTC', label: 'UTC — Universal Time' },
];

function RegisterForm(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');

  const [showPassword, setShowPassword] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormInput, unknown, RegisterInput>({
    resolver: zodResolver(RegisterInputSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      timezone: 'Asia/Jakarta',
    },
  });

  const onSubmit = async (data: RegisterInput) => {
    setServerError(null);
    try {
      await apiRegister(data);
      const target = returnUrl
        ? `/login?registered=true&returnUrl=${encodeURIComponent(returnUrl)}`
        : '/login?registered=true';
      router.push(target);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Terjadi kesalahan saat mendaftar. Silakan coba lagi.'
      );
    }
  };

  return (
    <Card className="w-full border-border bg-card shadow-xs">
      <CardHeader className="space-y-1.5 pb-4">
        <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          Daftar Akun StudyFlow
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Mulai atur kegiatan perkuliahan dan pelajari materi kuliahmu dalam satu tempat.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-4 pt-0">
          {/* Server Error Alert */}
          {serverError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="text-sm font-semibold">Pendaftaran Gagal</AlertTitle>
              <AlertDescription className="text-xs">{serverError}</AlertDescription>
            </Alert>
          )}

          {/* Name Field */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs font-semibold text-foreground">
              Nama Lengkap
            </Label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              placeholder="Contoh: Bima Khadafi"
              disabled={isSubmitting}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'name-error' : undefined}
              className="h-10 text-sm"
              {...register('name')}
            />
            {errors.name && (
              <p id="name-error" className="text-xs font-medium text-danger-foreground">
                {errors.name.message}
              </p>
            )}
          </div>

          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs font-semibold text-foreground">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="nama@kampus.ac.id"
              disabled={isSubmitting}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              className="h-10 text-sm"
              {...register('email')}
            />
            {errors.email && (
              <p id="email-error" className="text-xs font-medium text-danger-foreground">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password Field with Toggle */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-xs font-semibold text-foreground">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Minimal 12 karakter"
                disabled={isSubmitting}
                className="h-10 pr-10 text-sm"
                aria-invalid={!!errors.password}
                aria-describedby="password-hint password-error"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-1 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                tabIndex={0}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
            <p id="password-hint" className="text-xs text-muted-foreground">
              Minimal 12 karakter. Disarankan menggunakan passphrase yang mudah diingat.
            </p>
            {errors.password && (
              <p id="password-error" className="text-xs font-medium text-danger-foreground">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Timezone Selector */}
          <div className="space-y-2">
            <Label htmlFor="timezone" className="text-xs font-semibold text-foreground">
              Zona Waktu
            </Label>
            <select
              id="timezone"
              disabled={isSubmitting}
              className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50"
              {...register('timezone')}
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              Digunakan untuk menyesuaikan jadwal kuliah dan tenggat tugas.
            </p>
            {errors.timezone && (
              <p className="text-xs font-medium text-danger-foreground">
                {errors.timezone.message}
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4 pt-2">
          <Button
            type="submit"
            className="w-full font-semibold"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Memproses...</span>
              </>
            ) : (
              'Buat Akun'
            )}
          </Button>

          <Separator className="my-1" />

          <p className="text-center text-xs sm:text-sm text-muted-foreground">
            Sudah punya akun?{' '}
            <Link
              href={returnUrl ? `/login?returnUrl=${encodeURIComponent(returnUrl)}` : '/login'}
              className="font-medium text-primary underline underline-offset-4 hover:opacity-80 transition-opacity"
            >
              Masuk di sini
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function RegisterPage(): React.JSX.Element {
  return (
    <React.Suspense
      fallback={
        <Card className="w-full">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">Daftar Akun StudyFlow</CardTitle>
            <CardDescription>Memuat halaman pendaftaran...</CardDescription>
          </CardHeader>
          <CardContent className="h-48 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      }
    >
      <RegisterForm />
    </React.Suspense>
  );
}
