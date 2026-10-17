import * as React from 'react';
import Link from 'next/link';
import { GraduationCap, ShieldCheck } from 'lucide-react';
import { LoginForm } from '@/components/login-form';
import { FadeIn } from '@/components/ui/motion';

export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link href="/login" className="flex items-center gap-2 font-semibold tracking-tight">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-xs">
              <GraduationCap className="size-4" />
            </div>
            <span>StudyFlow</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
              Admin
            </span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <FadeIn className="w-full max-w-sm">
            <React.Suspense fallback={<div className="h-80 w-full animate-pulse rounded-lg bg-muted" />}>
              <LoginForm />
            </React.Suspense>
          </FadeIn>
        </div>
      </div>
      <div className="relative hidden lg:flex flex-col justify-between bg-muted p-10 dark:bg-card border-l border-border">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span>StudyFlow Control Center</span>
        </div>
        <div className="space-y-4 max-w-md">
          <div className="inline-block rounded-md bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            Sistem Manajemen Platform
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Pemantauan & Tata Kelola Platform Belajar Mahasiswa
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Akses analitik real-time, statistik materi dokumen, antrean pemrosesan AI, dan direktori pengguna StudyFlow dalam satu dashboard terpadu.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} StudyFlow. Hak cipta dilindungi.
        </div>
      </div>
    </div>
  );
}
