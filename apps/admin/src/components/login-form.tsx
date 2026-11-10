'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, AlertCircle, ShieldAlert } from 'lucide-react';
import { AdminLoginInputSchema } from '@studyflow/shared';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { loginAdminApi, AdminApiError } from '@/lib/admin-api';
import { useAdminAuth } from '@/components/admin-auth-context';

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'form'>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || '/dashboard';
  const urlError = searchParams.get('error');

  const { refreshUser } = useAdminAuth();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(
    urlError === 'unauthorized'
      ? 'Sesi administrator tidak valid atau akun tidak memiliki hak akses.'
      : null
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);

    const validationResult = AdminLoginInputSchema.safeParse({ email, password });
    if (!validationResult.success) {
      setErrorMsg(validationResult.error.issues[0]?.message || 'Input login admin tidak valid.');
      return;
    }

    setIsSubmitting(true);

    try {
      await loginAdminApi(validationResult.data);
      await refreshUser();
      router.push(from);
    } catch (err) {
      if (err instanceof AdminApiError) {
        setErrorMsg(err.message);
      } else if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Terjadi kesalahan saat masuk. Silakan coba lagi.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className={cn('flex flex-col gap-6', className)} onSubmit={handleSubmit} {...props}>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Masuk ke Akun Admin</h1>
        <p className="text-balance text-sm text-muted-foreground">
          Masukkan email dan kata sandi akun administrator Anda
        </p>
      </div>

      {errorMsg && (
        <Alert variant="destructive" className="py-3">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-xs font-semibold">Gagal Masuk</AlertTitle>
          <AlertDescription className="text-xs leading-relaxed mt-0.5">
            {errorMsg}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="admin@studyflow.internal"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            disabled={isSubmitting}
          />
        </div>

        <div className="grid gap-2">
          <div className="flex items-center">
            <Label htmlFor="password">Kata Sandi</Label>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={isSubmitting}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-hidden"
              aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full mt-2" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Memverifikasi...
            </>
          ) : (
            'Masuk'
          )}
        </Button>
      </div>

      <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-center text-xs text-muted-foreground">
        <div className="flex items-center justify-center gap-1.5 font-medium text-foreground mb-0.5">
          <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />
          Akses Khusus Administrator
        </div>
        Portal ini khusus untuk pengelolaan platform StudyFlow. Akun mahasiswa biasa tidak dapat masuk.
      </div>
    </form>
  );
}
