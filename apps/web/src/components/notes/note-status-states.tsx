'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function NoteLoadingState(): React.JSX.Element {
  return (
    <div className="flex h-96 items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">Memuat catatan...</p>
      </div>
    </div>
  );
}

export interface NoteErrorStateProps {
  loadError: string | null;
}

export function NoteErrorState({ loadError }: NoteErrorStateProps): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center my-8">
      <AlertCircle className="h-10 w-10 text-destructive" />
      <h3 className="mt-3 text-base font-semibold text-destructive">Catatan Tidak Ditemukan</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-md">
        {loadError || 'Catatan tidak ada atau Anda tidak memiliki akses.'}
      </p>
      <Link href="/notes" className="mt-4">
        <Button variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali ke Daftar Catatan
        </Button>
      </Link>
    </div>
  );
}
