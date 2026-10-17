'use client';

import * as React from 'react';
import { Activity, CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { AdminJobStatus, AdminQueueStatus } from '@studyflow/shared';
import { Badge } from '@/components/ui/badge';

export function JobStatusBadge({
  status,
  safeErrorMessage,
}: {
  status: AdminJobStatus;
  safeErrorMessage?: string | null;
}): React.JSX.Element {
  switch (status) {
    case 'COMPLETED':
      return (
        <Badge
          variant="outline"
          className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 text-xs font-medium"
        >
          <CheckCircle2 className="h-3 w-3 shrink-0" />
          <span>Selesai</span>
        </Badge>
      );
    case 'FAILED':
      return (
        <div className="flex flex-col items-start gap-1">
          <Badge
            variant="outline"
            className="gap-1 border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300 text-xs font-medium"
          >
            <XCircle className="h-3 w-3 shrink-0" />
            <span>Gagal</span>
          </Badge>
          {safeErrorMessage && (
            <span
              className="text-xs text-rose-600 dark:text-rose-400 line-clamp-1 max-w-[220px]"
              title={safeErrorMessage}
            >
              {safeErrorMessage}
            </span>
          )}
        </div>
      );
    case 'PROCESSING':
      return (
        <Badge
          variant="outline"
          className="gap-1 border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300 text-xs font-medium"
        >
          <Activity className="h-3 w-3 animate-pulse shrink-0" />
          <span>Diproses</span>
        </Badge>
      );
    case 'PENDING':
    default:
      return (
        <Badge
          variant="outline"
          className="gap-1 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300 text-xs font-medium"
        >
          <Clock className="h-3 w-3 shrink-0" />
          <span>Menunggu</span>
        </Badge>
      );
  }
}

export function JobQueueStatusBadge({
  queueStatus,
}: {
  queueStatus: AdminQueueStatus;
}): React.JSX.Element {
  switch (queueStatus) {
    case 'waiting':
      return (
        <Badge variant="outline" className="text-xs bg-muted/60 text-muted-foreground border-border">
          Antrean: Menunggu
        </Badge>
      );
    case 'active':
      return (
        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300">
          Antrean: Aktif
        </Badge>
      );
    case 'delayed':
      return (
        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300">
          Antrean: Tertunda
        </Badge>
      );
    case 'completed':
      return (
        <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">
          Antrean: Selesai
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="outline" className="text-xs bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300">
          Antrean: Gagal
        </Badge>
      );
    case 'not_found':
      return (
        <Badge variant="secondary" className="text-xs font-normal">
          Dibersihkan dari Memori
        </Badge>
      );
    case 'unavailable':
      return (
        <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">
          Tidak Tersedia
        </Badge>
      );
    default:
      return <Badge variant="secondary">{queueStatus}</Badge>;
  }
}
