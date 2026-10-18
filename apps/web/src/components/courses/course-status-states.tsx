'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function CourseLoadingSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48 rounded-lg" />
      <Skeleton className="h-44 w-full rounded-xl" />
      <Skeleton className="h-10 w-80 rounded-lg" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export interface CourseErrorAlertProps {
  errorMsg: string | null;
}

export function CourseErrorAlert({ errorMsg }: CourseErrorAlertProps): React.JSX.Element {
  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild size="sm" className="h-8 gap-2 text-sm w-fit -ml-2">
        <Link href="/courses">
          <ArrowLeft className="h-4 w-4" />
          <span>Kembali ke Daftar Mata Kuliah</span>
        </Link>
      </Button>
      <Alert variant="destructive">
        <AlertCircle className="h-5 w-5" />
        <AlertTitle>Mata Kuliah Tidak Ditemukan</AlertTitle>
        <AlertDescription className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span>
            {errorMsg || 'Mata kuliah tidak ditemukan atau Anda tidak memiliki akses ke halaman ini.'}
          </span>
          <Button asChild variant="outline" size="sm" className="w-fit">
            <Link href="/courses">Lihat Semua Mata Kuliah</Link>
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
