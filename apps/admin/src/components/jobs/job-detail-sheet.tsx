'use client';

import * as React from 'react';
import Link from 'next/link';
import { Activity, AlertCircle, Check, Copy, User } from 'lucide-react';
import type { AdminJobDetail } from '@studyflow/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  formatJobDuration,
  formatLocalDateTime,
  getJobTypeLabel,
} from '@/lib/admin-formatters';
import { JobQueueStatusBadge, JobStatusBadge } from './job-status-badge';

interface JobDetailSheetProps {
  selectedJobId: string | null;
  onClose: () => void;
  onRetry: () => void;
  isDetailLoading: boolean;
  detailError: string | null;
  jobDetail: AdminJobDetail | null;
}

export function JobDetailSheet({
  selectedJobId,
  onClose,
  onRetry,
  isDetailLoading,
  detailError,
  jobDetail,
}: JobDetailSheetProps): React.JSX.Element {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((curr) => (curr === key ? null : curr));
    }, 2000);
  };

  return (
    <Sheet open={Boolean(selectedJobId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="sm:max-w-md w-full overflow-y-auto">
        <SheetHeader className="text-left border-b border-border pb-4">
          <SheetTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Detail Pekerjaan Operasional
          </SheetTitle>
          <SheetDescription className="text-xs">
            Informasi pelacakan teknis dan riwayat eksekusi pekerjaan secara aman.
          </SheetDescription>
        </SheetHeader>

        {isDetailLoading ? (
          <div className="py-6 space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : detailError ? (
          <div className="py-6 space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Gagal Memuat Detail</AlertTitle>
              <AlertDescription className="text-xs mt-1">{detailError}</AlertDescription>
            </Alert>
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="w-full"
            >
              Coba Lagi
            </Button>
          </div>
        ) : jobDetail ? (
          <div className="py-4 space-y-4 text-xs">
            {/* ID Pekerjaan */}
            <div className="rounded-md border border-border p-3 bg-muted/20">
              <span className="text-muted-foreground font-medium block">ID Pekerjaan</span>
              <div className="flex items-center justify-between gap-2 mt-1">
                <span className="font-mono text-xs text-foreground select-all break-all">
                  {jobDetail.id}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs gap-1 shrink-0"
                  onClick={() => handleCopy(jobDetail.id, 'jobId')}
                >
                  {copiedKey === 'jobId' ? (
                    <Check className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>

            {/* Status Section */}
            <div className="rounded-md border border-border p-3 bg-muted/20 space-y-2">
              <span className="text-muted-foreground font-medium block">Status Operasional</span>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status Database (Permanen):</span>
                  <JobStatusBadge status={jobDetail.status} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status Antrean (BullMQ):</span>
                  <JobQueueStatusBadge queueStatus={jobDetail.queueStatus} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground/80 pt-1 border-t border-border/50">
                Status antrean menandakan kondisi transien pada Redis. Jika job telah melewati batas retensi, antrean menampilkan &quot;Dibersihkan dari Memori&quot;.
              </p>
            </div>

            {/* Identitas Pengguna */}
            <div className="rounded-md border border-border p-3 bg-muted/20 space-y-1.5">
              <span className="text-muted-foreground font-medium block">Pengguna Terkait</span>
              <div className="flex items-center justify-between">
                <span className="text-foreground font-semibold">{jobDetail.userName}</span>
                <Button variant="outline" size="sm" asChild className="h-6 px-2 text-xs">
                  <Link href={`/users/${jobDetail.userId}`}>
                    <User className="h-3 w-3 mr-1" />
                    Profil
                  </Link>
                </Button>
              </div>
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span className="font-mono truncate max-w-[200px]">{jobDetail.userId}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1 text-xs"
                  onClick={() => handleCopy(jobDetail.userId, 'userId')}
                >
                  {copiedKey === 'userId' ? 'Disalin' : 'Salin ID'}
                </Button>
              </div>
            </div>

            {/* Job Metadata */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-border p-2.5 bg-muted/20">
                <span className="text-muted-foreground block text-xs">Jenis Pekerjaan</span>
                <span className="font-semibold text-foreground mt-0.5 block">
                  {getJobTypeLabel(jobDetail.type)}
                </span>
              </div>
              <div className="rounded-md border border-border p-2.5 bg-muted/20">
                <span className="text-muted-foreground block text-xs">Attempt</span>
                <span className="font-semibold text-foreground font-mono tabular-nums mt-0.5 block">
                  {jobDetail.attempts} / {jobDetail.maxAttempts}
                </span>
              </div>
            </div>

            {/* Timestamps */}
            <div className="rounded-md border border-border p-3 bg-muted/20 space-y-1.5">
              <span className="text-muted-foreground font-medium block">Jejak Waktu</span>
              <div className="space-y-1 text-xs tabular-nums">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Waktu Dibuat:</span>
                  <span className="font-mono text-foreground">
                    {formatLocalDateTime(jobDetail.createdAt, true)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Waktu Mulai:</span>
                  <span className="font-mono text-foreground">
                    {formatLocalDateTime(jobDetail.startedAt, true)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Waktu Selesai:</span>
                  <span className="font-mono text-foreground">
                    {formatLocalDateTime(jobDetail.completedAt, true)}
                  </span>
                </div>
                {jobDetail.failedAt && (
                  <div className="flex justify-between text-destructive">
                    <span>Waktu Gagal:</span>
                    <span className="font-mono">
                      {formatLocalDateTime(jobDetail.failedAt, true)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border/50 pt-1 mt-1">
                  <span className="text-muted-foreground font-medium">Durasi Eksekusi:</span>
                  <span className="font-mono font-semibold text-foreground">
                    {formatJobDuration(jobDetail.durationMs)}
                  </span>
                </div>
              </div>
            </div>

            {/* Error Information (if failed) */}
            {jobDetail.status === 'FAILED' && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 space-y-1 text-xs text-destructive">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" />
                  <span>Kode Kesalahan: {jobDetail.errorCode || 'UNKNOWN_ERROR'}</span>
                </div>
                <p className="text-xs text-foreground/80 mt-1 leading-relaxed">
                  {jobDetail.safeErrorMessage || 'Terjadi kegagalan operasional saat mengeksekusi pekerjaan.'}
                </p>
              </div>
            )}

            {/* Privacy Notice */}
            <div className="rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold block text-foreground mb-0.5">
                Proteksi Privasi Pengguna:
              </span>
              Isi dokumen PDF, teks prompt, respons model AI mentah, kredensial, dan URL unduhan materi dilindungi secara ketat dan tidak diekspos melalui portal administrator.
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
