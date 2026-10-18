'use client';

import * as React from 'react';
import {
  HardDrive,
  FileUp,
  Info,
  Loader2,
} from 'lucide-react';
import {
  formatFileSize,
  StorageUsageResponse,
} from '@studyflow/shared';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export interface StorageUsageSectionProps {
  storageUsage: StorageUsageResponse | null;
  loading: boolean;
}

export function StorageUsageSection({ storageUsage, loading }: StorageUsageSectionProps): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-primary font-semibold text-sm">
          <HardDrive className="h-4 w-4" />
          <span>Penyimpanan & Kuota</span>
        </div>
        <CardTitle className="text-lg">Kapasitas Ruang & Batas Upload</CardTitle>
        <CardDescription>
          Informasi kapasitas ruang penyimpanan materi PDF dan batasan upload akun Anda.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : storageUsage ? (
          <>
            {/* Storage Space Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">Kapasitas Penyimpanan</span>
                <span className="text-muted-foreground text-xs font-mono tabular-nums">
                  {formatFileSize(storageUsage.usedBytes)} / {formatFileSize(storageUsage.limitBytes)} ({storageUsage.percentage.toFixed(1)}%)
                </span>
              </div>
              <Progress
                value={Math.min(100, Math.round((storageUsage.usedBytes / storageUsage.limitBytes) * 100))}
                className="h-2.5"
              />
            </div>

            {/* Upload Limit Grid */}
            <div className="grid gap-3 sm:grid-cols-2 rounded-xl border border-border bg-muted/20 p-4">
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <FileUp className="h-3.5 w-3.5 text-primary" />
                  Upload Hari Ini
                </p>
                <p className="text-lg font-bold text-foreground tabular-nums">
                  {storageUsage.dailyUploadsCount} / {storageUsage.dailyUploadsLimit} file
                </p>
                <Progress
                  value={
                    storageUsage.dailyUploadsLimit > 0
                      ? Math.min(100, Math.round((storageUsage.dailyUploadsCount / storageUsage.dailyUploadsLimit) * 100))
                      : 0
                  }
                  className="h-1.5"
                />
                <p className="text-xs text-muted-foreground tabular-nums">
                  Sisa kuota: {Math.max(0, storageUsage.dailyUploadsLimit - storageUsage.dailyUploadsCount)} upload hari ini.
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-primary" />
                  Reset Kuota Harian
                </p>
                <p className="text-sm font-semibold text-foreground tabular-nums">
                  Pukul 00:00 UTC
                </p>
                <p className="text-xs text-muted-foreground">
                  Reset otomatis setiap tengah malam UTC.
                </p>
              </div>
            </div>

            {/* PDF Document Limits */}
            <div className="rounded-lg border border-border/70 bg-muted/10 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Ketentuan File PDF:</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs">
                <li>Maksimal ukuran 20 MB per file PDF berbasis teks.</li>
                <li>Maksimal 100 halaman per dokumen.</li>
                <li>PDF hasil pemindaian gambar murni (scanned) belum didukung pada versi ini.</li>
              </ul>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Tidak dapat memuat informasi penyimpanan.</p>
        )}
      </CardContent>
    </Card>
  );
}
