'use client';

import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FadeIn } from '@/components/ui/motion';

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 bg-muted/30">
      <FadeIn className="w-full max-w-md">
        <Card className="w-full max-w-md text-center border-border shadow-xs">
          <CardHeader className="space-y-2 pb-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <ShieldAlert className="h-8 w-8" aria-hidden="true" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight tabular-nums">
              403 — Akses Ditolak
            </CardTitle>
            <CardDescription>
              Akun Anda tidak memiliki izin akses untuk melihat halaman ini.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-2">
            <p className="text-sm text-muted-foreground">
              Pastikan Anda masuk menggunakan akun yang berwenang atau hubungi tim pengelola StudyFlow jika membutuhkan bantuan.
            </p>
          </CardContent>
          <CardFooter className="justify-center pt-4">
            <Button asChild variant="outline">
              <Link href="/login" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Kembali ke Login
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </FadeIn>
    </div>
  );
}
