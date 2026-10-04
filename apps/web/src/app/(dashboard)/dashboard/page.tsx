import * as React from 'react';
import Link from 'next/link';
import { getServerSessionUser } from '@/lib/auth-server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
  CheckCircle2,
  Settings,
  Calendar,
  Layers,
  BookOpen,
  ArrowRight,
} from 'lucide-react';

export default async function DashboardPage(): Promise<React.JSX.Element> {
  const user = await getServerSessionUser();

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-xl border border-border bg-card p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 mb-2">
              <Badge variant="outline" className="gap-1.5 py-0.5 text-xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Sesi Aktif
              </Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Halo, {user?.name || 'Mahasiswa'}!
            </h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              Selamat datang di ruang belajar pribadimu. Akunmu telah aktif dan terhubung aman.
            </p>
          </div>

          <Link href="/settings">
            <Button variant="outline" className="gap-2">
              <Settings className="h-4 w-4" />
              <span>Pengaturan Akun</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Product Milestone Progress Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-primary text-sm font-semibold">
            <CheckCircle2 className="h-4 w-4" />
            <span>Milestone 2 Selesai — Sistem Autentikasi & Shell UI</span>
          </div>
          <CardTitle className="text-lg">Persiapan Area Perkuliahan</CardTitle>
          <CardDescription>
            Sistem autentikasi mandiri, keamanan sesi JWT/cookie HttpOnly, dan app shell responsif telah siap.
            Fitur pengelolaan semester dan mata kuliah akan dibuka pada tahap berikutnya.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border/70 bg-background/50 p-4">
              <div className="flex items-center gap-2.5 font-medium text-foreground text-sm">
                <Calendar className="h-4 w-4 text-primary" />
                <span>Zona Waktu Akun</span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                Zona waktu saat ini: <strong className="text-foreground">{user?.timezone || 'Asia/Jakarta'}</strong>.
                Seluruh deadline dan kuota akan disesuaikan dengan zona waktu ini.
              </p>
            </div>

            <div className="rounded-lg border border-border/70 bg-background/50 p-4">
              <div className="flex items-center gap-2.5 font-medium text-foreground text-sm">
                <Layers className="h-4 w-4 text-primary" />
                <span>Tahap Selanjutnya (Milestone 3)</span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                Pengelolaan semester aktif/arsip, daftar mata kuliah, dan struktur perkuliahan pribadi.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
