'use client';

import * as React from 'react';
import {
  Loader2,
  Clock3,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { MaterialStatus } from '@studyflow/shared';
import { Badge } from '@/components/ui/badge';

interface MaterialStatusBadgeProps {
  status: MaterialStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
  className?: string;
}

export function MaterialStatusBadge({
  status,
  errorCode,
  errorMessage,
  className = '',
}: MaterialStatusBadgeProps): React.JSX.Element {
  switch (status) {
    case 'UPLOADING':
      return (
        <Badge
          variant="outline"
          className={`gap-1.5 border-primary/40 bg-primary/10 text-primary ${className}`}
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Mengunggah…</span>
        </Badge>
      );

    case 'QUEUED':
      return (
        <Badge
          variant="secondary"
          className={`gap-1.5 bg-muted text-muted-foreground ${className}`}
        >
          <Clock3 className="h-3.5 w-3.5" />
          <span>Dalam antrean</span>
        </Badge>
      );

    case 'PROCESSING':
      return (
        <Badge
          variant="outline"
          className={`gap-1.5 border-primary/40 bg-primary/10 text-primary ${className}`}
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Membaca isi PDF…</span>
        </Badge>
      );

    case 'READY':
      return (
        <Badge
          variant="outline"
          className={`gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ${className}`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Siap dipelajari</span>
        </Badge>
      );

    case 'FAILED':
      return (
        <Badge
          variant="danger"
          className={`gap-1.5 text-danger-foreground ${className}`}
          title={errorMessage || errorCode || 'Gagal diproses'}
        >
          <AlertCircle className="h-3.5 w-3.5" />
          <span>
            {errorCode === 'SCANNED_PDF_NO_TEXT'
              ? 'Scan gambar (tanpa teks)'
              : errorCode === 'EXCEEDS_PAGE_LIMIT'
              ? 'Melebihi 100 hal.'
              : errorCode === 'FILE_ENCRYPTED'
              ? 'Terenkripsi'
              : errorCode === 'FILE_TOO_LARGE'
              ? 'Melebihi 20 MB'
              : 'Gagal diproses'}
          </span>
        </Badge>
      );

    default:
      return (
        <Badge variant="outline" className={`gap-1.5 ${className}`}>
          <FileText className="h-3.5 w-3.5" />
          <span>{status}</span>
        </Badge>
      );
  }
}
