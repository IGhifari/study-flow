'use client';

import * as React from 'react';
import {
  Users,
  FileText,
  CheckSquare,
  AlertTriangle,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { fetchAdminSummary } from '@/lib/admin-api';
import { AdminSummary } from '@studyflow/shared';

export default function AdminDashboardPage() {
  const [summary, setSummary] = React.useState<AdminSummary | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadSummary = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchAdminSummary();
      setSummary(data);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat ringkasan statistik platform');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Ringkasan Platform
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pantau pertumbuhan pengguna, dokumen materi, tugas, dan kestabilan antrean AI secara langsung.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadSummary}
          disabled={isLoading}
          className="self-start sm:self-auto gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Perbarui Data
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Terjadi Kesalahan</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={loadSummary}
              className="bg-card text-foreground"
            >
              Coba Lagi
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Metric Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Pengguna */}
        <Card className="border-border bg-card shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Pengguna
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-4 w-4" aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold text-foreground">
                  {summary ? summary.totalUsers.toLocaleString('id-ID') : '0'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Akun mahasiswa terdaftar
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Total Materi */}
        <Card className="border-border bg-card shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Materi
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <FileText className="h-4 w-4" aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold text-foreground">
                  {summary ? summary.totalMaterials.toLocaleString('id-ID') : '0'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Dokumen aktif (tidak termasuk arsip/terhapus)
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Total Tugas */}
        <Card className="border-border bg-card shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Tugas
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckSquare className="h-4 w-4" aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold text-foreground">
                  {summary ? summary.totalAssignments.toLocaleString('id-ID') : '0'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Tugas akademik dibuat mahasiswa
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Gagal AI (24 Jam) */}
        <Card className="border-border bg-card shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gagal AI (24 Jam)
            </CardTitle>
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                summary && summary.failedJobs24h > 0
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold text-foreground">
                    {summary ? summary.failedJobs24h.toLocaleString('id-ID') : '0'}
                  </span>
                  {summary && summary.failedJobs24h === 0 ? (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 text-xs">
                      Normal
                    </Badge>
                  ) : (
                    <Badge variant="danger" className="text-xs">
                      Perlu Perhatian
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Pekerjaan ekstraksi/generasi AI gagal 24 jam terakhir
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Information Notes */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Cakupan Data & Kebijakan Metrik</CardTitle>
          <CardDescription>
            Definisi teknis batas agregasi data yang disajikan pada dashboard administrator.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            • <strong>Total Pengguna:</strong> Menghitung seluruh catatan pengguna yang tersimpan pada tabel basis data.
          </p>
          <p>
            • <strong>Total Materi:</strong> Menghitung dokumen pembelajaran aktif, mengecualikan dokumen dengan status soft-delete (deletedAt terisi).
          </p>
          <p>
            • <strong>Total Tugas:</strong> Seluruh item tugas akademik mahasiswa lintas semester.
          </p>
          <p>
            • <strong>Gagal AI (24 Jam):</strong> Pekerjaan antrean pemrosesan dokumen atau generasi AI yang mengalami status FAILED dalam rentang waktu 24 jam dari waktu perhitungan saat ini.
          </p>
          {summary && (
            <p className="text-xs text-muted-foreground/80 pt-2 border-t border-border">
              Terakhir dihitung pada: {new Date(summary.calculatedAt).toLocaleString('id-ID')}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
