'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  AlertCircle,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function MaterialLoadingState(): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="mt-3 text-sm font-medium">Memuat materi kuliah...</p>
    </div>
  );
}

export interface MaterialErrorStateProps {
  errorMessage: string | null;
}

export function MaterialErrorState({ errorMessage }: MaterialErrorStateProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="standard" asChild className="gap-2 text-xs w-fit">
        <Link href="/materials">
          <ArrowLeft className="h-4 w-4" />
          <span>Kembali ke Materi</span>
        </Link>
      </Button>

      <Card className="p-8 sm:p-12 text-center bg-card border border-border shadow-xs">
        <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
        <h3 className="mt-3 text-base font-semibold text-foreground">Gagal Memuat Materi</h3>
        <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
          {errorMessage || 'Materi tidak ditemukan atau telah dihapus.'}
        </p>
        <Button asChild size="standard" className="mt-5">
          <Link href="/materials">Kembali ke Daftar Materi</Link>
        </Button>
      </Card>
    </div>
  );
}

export interface MaterialProcessingCardProps {
  status: 'QUEUED' | 'PROCESSING';
}

export function MaterialProcessingCard({ status }: MaterialProcessingCardProps): React.JSX.Element {
  return (
    <Card className="p-10 sm:p-14 text-center bg-card border border-border shadow-xs">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-foreground">
        {status === 'QUEUED'
          ? 'Menunggu antrean pemrosesan'
          : 'Membaca dan mengekstrak isi PDF...'}
      </h3>
      <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
        Dokumen sedang dianalisis dan diekstrak teks halamannya. Halaman akan otomatis diperbarui begitu proses selesai.
      </p>
    </Card>
  );
}

export interface MaterialFailedCardProps {
  errorMessage?: string | null;
  isRetrying: boolean;
  isArchived: boolean;
  onRetry: () => void;
}

export function MaterialFailedCard({
  errorMessage,
  isRetrying,
  isArchived,
  onRetry,
}: MaterialFailedCardProps): React.JSX.Element {
  return (
    <Card className="border-destructive/30 bg-destructive/5 p-8 sm:p-10 text-center shadow-xs">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h3 className="mt-3 text-base font-semibold text-destructive">Gagal Memproses Dokumen</h3>
      <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
        {errorMessage ||
          'Terjadi kendala saat membaca berkas PDF. Pastikan file berbasis teks yang valid dan tidak diproteksi password.'}
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <Button
          variant="outline"
          size="standard"
          onClick={onRetry}
          disabled={isRetrying || isArchived}
          className="gap-1.5 text-xs"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Coba Lagi</span>
        </Button>
        <Button variant="default" size="standard" asChild className="text-xs">
          <Link href="/materials">Kembali ke Daftar</Link>
        </Button>
      </div>
    </Card>
  );
}
