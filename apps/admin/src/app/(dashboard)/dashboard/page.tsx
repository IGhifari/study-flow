'use client';

import * as React from 'react';
import { RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { SectionCards } from '@/components/section-cards';
import { ChartAreaInteractive } from '@/components/chart-area-interactive';
import { DataTable } from '@/components/data-table';
import { fetchAdminSummary } from '@/lib/admin-api';
import type { AdminSummary } from '@studyflow/shared';

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
    <div className="flex flex-1 flex-col gap-6 py-6 w-full max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 lg:px-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Dashboard Administrator
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              <Sparkles className="h-3 w-3" />
              v1.0
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Pantau pertumbuhan mahasiswa, dokumen materi kuliah, tugas akademik, dan kesehatan antrean AI.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadSummary}
          disabled={isLoading}
          className="self-start sm:self-auto gap-2 h-9 px-3 text-xs md:text-sm shadow-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Perbarui Data
        </Button>
      </div>

      {error && (
        <div className="px-4 lg:px-6">
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
        </div>
      )}

      {/* 1. Metric Cards (dashboard-01 SectionCards with subtle gradients, pills & trending indicators) */}
      <SectionCards summary={summary} isLoading={isLoading} />

      {/* 2. Interactive Area Chart (dashboard-01 ChartAreaInteractive with 90d/30d/7d time range) */}
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>

      {/* 3. Platform Modules & Health Table */}
      <DataTable />

      {/* 4. Technical Policy & Metrics Scope */}
      <div className="px-4 lg:px-6">
        <Card className="border-border bg-card shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Cakupan Data & Kebijakan Metrik</CardTitle>
            <CardDescription>
              Definisi teknis batas agregasi data yang disajikan pada dashboard administrator StudyFlow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              • <strong>Total Pengguna:</strong> Menghitung seluruh catatan akun mahasiswa aktif yang tersimpan pada database utama.
            </p>
            <p>
              • <strong>Total Materi:</strong> Menghitung dokumen pembelajaran aktif, mengecualikan dokumen dengan status soft-delete (deletedAt terisi).
            </p>
            <p>
              • <strong>Total Tugas:</strong> Seluruh item tugas akademik mahasiswa lintas semester.
            </p>
            <p>
              • <strong>Gagal AI (24 Jam):</strong> Pekerjaan antrean pemrosesan dokumen atau generasi AI yang berstatus FAILED dalam rentang waktu 24 jam terakhir.
            </p>
            {summary && (
              <p className="text-xs text-muted-foreground/80 pt-2 border-t border-border">
                Terakhir dihitung pada: {new Date(summary.calculatedAt).toLocaleString('id-ID')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
