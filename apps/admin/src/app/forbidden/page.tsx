'use client';

import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md text-center border-border shadow-md">
        <CardHeader className="space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <ShieldAlert className="h-8 w-8" aria-hidden="true" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            403 — Akses Ditolak
          </CardTitle>
          <CardDescription>
            Akun Anda tidak memiliki hak administrator yang sah untuk melihat halaman ini.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Jika Anda adalah staf atau pengelola yang berwenang, pastikan Anda masuk menggunakan akun dengan peran ADMIN atau hubungi pengembang sistem.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            <Button asChild variant="outline">
              <Link href="/login" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Kembali ke Login
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
