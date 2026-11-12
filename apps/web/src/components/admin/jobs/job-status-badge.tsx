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
          className="gap-1 border-transparent bg-success text-success-foreground text-xs font-medium"
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
            className="gap-1 border-transparent bg-danger text-danger-foreground text-xs font-medium"
          >
            <XCircle className="h-3 w-3 shrink-0" />
            <span>Gagal</span>
          </Badge>
          {safeErrorMessage && (
            <span
              className="text-xs text-destructive line-clamp-1 max-w-[220px]"
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
          className="gap-1 border-primary/20 bg-primary/10 text-primary text-xs font-medium animate-pulse"
        >
          <Activity className="h-3 w-3 animate-spin shrink-0" />
          <span>Diproses</span>
        </Badge>
      );
    case 'PENDING':
    default:
      return (
        <Badge
          variant="outline"
          className="gap-1 border-transparent bg-warning text-warning-foreground text-xs font-medium"
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
        <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
          Antrean: Aktif
        </Badge>
      );
    case 'delayed':
      return (
        <Badge variant="outline" className="text-xs bg-warning text-warning-foreground border-transparent">
          Antrean: Tertunda
        </Badge>
      );
    case 'completed':
      return (
        <Badge variant="outline" className="text-xs bg-success text-success-foreground border-transparent">
          Antrean: Selesai
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="outline" className="text-xs bg-danger text-danger-foreground border-transparent">
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
