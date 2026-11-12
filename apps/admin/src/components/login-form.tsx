'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { AdminLoginInputSchema } from '@studyflow/shared';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginAdminApi } from '@/lib/admin-api';
import { useAdminAuth } from '@/components/admin-auth-context';

type FieldErrors = Partial<Record<'email' | 'password', string>>;

/** Hanya izinkan redirect internal relatif agar parameter `from` tidak bisa diarahkan ke domain lain. */
function getSafeRedirect(from: string | null): string {
  if (!from || !from.startsWith('/') || from.startsWith('//') || from.startsWith('/\\')) {
    return '/dashboard';
  }
  return from;
}

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'form'>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = getSafeRedirect(searchParams.get('from'));
  const urlError = searchParams.get('error');

  const { refreshUser } = useAdminAuth();

  const emailRef = React.useRef<HTMLInputElement>(null);
  const passwordRef = React.useRef<HTMLInputElement>(null);

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [capsLockOn, setCapsLockOn] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(
    urlError === 'unauthorized'
      ? 'Sesi administrator tidak valid atau akun tidak memiliki hak akses.'
      : null
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleCapsLock = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(e.getModifierState('CapsLock'));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    setFormError(null);
    setFieldErrors({});

    const validationResult = AdminLoginInputSchema.safeParse({ email, password });
    if (!validationResult.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of validationResult.error.issues) {
        const field = issue.path[0];
        if ((field === 'email' || field === 'password') && !nextErrors[field]) {
          nextErrors[field] = issue.message;
        }
      }
      setFieldErrors(nextErrors);
      (nextErrors.email ? emailRef : passwordRef).current?.focus();
      return;
    }

    setIsSubmitting(true);

    try {
      await loginAdminApi(validationResult.data);
      await refreshUser();
      router.push(redirectTo);
    } catch (err) {
      setFormError(
        err instanceof Error && err.message
          ? err.message
          : 'Terjadi kesalahan saat masuk. Silakan coba lagi.'
      );
      passwordRef.current?.select();
      passwordRef.current?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col items-center gap-3 px-6 pt-8 text-center sm:px-8">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="size-6" aria-hidden="true" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Masuk sebagai Administrator</h1>
          <p className="text-balance text-sm text-muted-foreground">
            Gunakan akun administrator StudyFlow untuk mengelola platform.
          </p>
        </div>
      </div>

      <form
        className={cn('flex flex-col gap-5 px-6 pb-8 pt-6 sm:px-8', className)}
        onSubmit={handleSubmit}
        noValidate
        aria-busy={isSubmitting}
        {...props}
      >
        <div aria-live="polite">
          {formError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div className="min-w-0 space-y-0.5">
                <p className="font-semibold">Gagal masuk</p>
                <p className="break-words leading-relaxed">{formError}</p>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            ref={emailRef}
            id="email"
            name="email"
            type="email"
            inputMode="email"
            placeholder="nama@domain.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
            }}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            readOnly={isSubmitting}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            className={cn(fieldErrors.email && 'border-destructive focus-visible:ring-destructive')}
          />
          {fieldErrors.email && (
            <p id="email-error" className="text-xs text-destructive">
              {fieldErrors.email}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="password">Kata Sandi</Label>
          <div className="relative">
            <Input
              ref={passwordRef}
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
              }}
              onKeyUp={handleCapsLock}
              onKeyDown={handleCapsLock}
              onBlur={() => setCapsLockOn(false)}
              autoComplete="current-password"
              readOnly={isSubmitting}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={
                [fieldErrors.password && 'password-error', capsLockOn && 'password-capslock']
                  .filter(Boolean)
                  .join(' ') || undefined
              }
              className={cn('pr-11', fieldErrors.password && 'border-destructive focus-visible:ring-destructive')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-1 top-1/2 inline-flex size-8 -translate-y-1/2 touch-manipulation items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring after:absolute after:-inset-1.5 sm:after:hidden"
              aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              aria-pressed={showPassword}
              aria-controls="password"
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {fieldErrors.password && (
            <p id="password-error" className="text-xs text-destructive">
              {fieldErrors.password}
            </p>
          )}
          {capsLockOn && (
            <p id="password-capslock" className="text-xs font-medium text-amber-700 dark:text-amber-400">
              Caps Lock aktif.
            </p>
          )}
        </div>

        <Button type="submit" className="mt-1 h-10 w-full font-semibold" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
              Memverifikasi…
            </>
          ) : (
            'Masuk'
          )}
        </Button>

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          Portal khusus administrator. Akun mahasiswa tidak dapat masuk di sini.
        </p>
      </form>
    </div>
  );
}
