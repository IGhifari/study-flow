'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  CalendarRange,
  BookOpen,
  Plus,
  ArrowRight,
  User,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  ListTodo,
  TrendingUp,
  FileText,
  FileUp,
} from 'lucide-react';
import {
  DashboardSummary,
  UserProfile,
  formatUserDateTime,
  formatFileSize,
  Assignment,
} from '@studyflow/shared';
import { MaterialStatusBadge } from '@/components/materials/material-status-badge';
import { getDashboardSummary } from '@/lib/dashboard-client';
import { updateAssignment } from '@/lib/assignment-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';

interface DashboardContentProps {
  user: UserProfile;
}

export function DashboardContent({ user }: DashboardContentProps): React.JSX.Element {
  const [summary, setSummary] = React.useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const timezone = user.timezone || 'Asia/Jakarta';

  const loadSummary = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await getDashboardSummary();
      setSummary(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat data ringkasan dashboard.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // Toggle status directly from dashboard
  const handleToggleTask = async (asg: Assignment) => {
    const nextStatus = asg.status === 'DONE' ? 'TODO' : 'DONE';
    try {
      await updateAssignment(asg.id, { status: nextStatus });
      loadSummary();
    } catch (err: any) {
      alert(err.message || 'Gagal memperbarui status tugas');
    }
  };

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
              {summary?.activeSemester && (
                <Badge variant="secondary" className="gap-1 py-0.5 text-xs font-normal">
                  <CalendarRange className="h-3 w-3" />
                  {summary.activeSemester.name}
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Halo, {user.name}!
            </h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              Pantau prioritas tugas kuliah dan aktivitas belajar semester ini secara teratur.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/assignments" className="gap-2">
                <ListTodo className="h-4 w-4" />
                <span>Lihat Semua Tugas</span>
              </Link>
            </Button>
            <Button asChild>
              <Link href="/courses" className="gap-2">
                <BookOpen className="h-4 w-4" />
                <span>Mata Kuliah</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger-foreground">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0 text-danger" />
            <span>{errorMsg}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadSummary()}>
            Coba Lagi
          </Button>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm">Menyiapkan data dashboard...</p>
        </div>
      ) : !summary?.activeSemester ? (
        /* State 1: Belum ada semester aktif */
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm font-semibold">
              <AlertCircle className="h-4 w-4" />
              <span>Belum Ada Semester Aktif</span>
            </div>
            <CardTitle className="text-lg">Pilih Semester yang Sedang Berjalan</CardTitle>
            <CardDescription>
              Tentukan semester aktif untuk melihat ringkasan tugas dan mata kuliah semester berjalan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="gap-2">
              <Link href="/semesters">
                <span>Kelola Semester</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : summary.totalCourses === 0 ? (
        /* State 2: Semester aktif ada, tetapi belum ada mata kuliah aktif */
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  Semester Aktif: {summary.activeSemester.name}
                </CardTitle>
                <CardDescription>
                  Tahun Ajaran: {summary.activeSemester.academicYear}
                </CardDescription>
              </div>
              <Badge variant="default">Aktif</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg border-dashed bg-muted/20">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <BookOpen className="h-5 w-5" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-foreground">
                Belum Ada Mata Kuliah di Semester Ini
              </h3>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Tambahkan mata kuliah untuk mulai mencatat tugas dan materi kuliah.
              </p>
              <Button asChild size="sm" className="mt-4 gap-1.5">
                <Link href="/courses">
                  <Plus className="h-3.5 w-3.5" />
                  <span>Tambah Mata Kuliah</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* State 3: Active Dashboard with Real Aggregated Metrics */
        <div className="space-y-6">
          {/* Key Metric Statistics Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Hari Ini */}
            <Card className="p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Jatuh Hari Ini
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Clock className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight text-foreground">
                    {summary.assignmentsToday.length}
                  </span>
                  <span className="text-xs text-muted-foreground">tugas belum selesai</span>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Batas 23.59 {timezone}
              </p>
            </Card>

            {/* Card 2: 7 Hari Mendatang */}
            <Card className="p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    7 Hari ke Depan
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500">
                    <Calendar className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight text-foreground">
                    {summary.assignmentsUpcoming.length}
                  </span>
                  <span className="text-xs text-muted-foreground">tugas mendatang</span>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Jadwal dalam rentang 7 hari lokal
              </p>
            </Card>

            {/* Card 3: Terlambat */}
            <Card className={`p-5 shadow-xs flex flex-col justify-between ${
              summary.overdueCount > 0 ? 'border-danger/30 bg-danger/5' : ''
            }`}>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Tugas Terlambat
                  </span>
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    summary.overdueCount > 0
                      ? 'bg-danger/20 text-danger'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className={`text-3xl font-bold tracking-tight ${
                    summary.overdueCount > 0 ? 'text-danger' : 'text-foreground'
                  }`}>
                    {summary.overdueCount}
                  </span>
                  <span className="text-xs text-muted-foreground">tugas lewat deadline</span>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                {summary.overdueCount > 0 ? 'Perlu segera diselesaikan' : 'Semua deadline aman'}
              </p>
            </Card>

            {/* Card 4: Progres Selesai */}
            <Card className="p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Penyelesaian Tugas
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight text-foreground">
                    {summary.completionPercentage}%
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({summary.completedCount} dari {summary.totalAssignments})
                  </span>
                </div>
              </div>
              <div className="mt-3 w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${summary.completionPercentage}%` }}
                />
              </div>
            </Card>
          </div>

          {/* Tasks Sections: Hari Ini & Mendatang */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Tugas Hari Ini */}
            <Card className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base font-semibold">Tugas Hari Ini</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {summary.assignmentsToday.length} tugas
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                {summary.assignmentsToday.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500/80 mb-2" />
                    <p className="text-xs font-semibold text-foreground">Tidak ada deadline hari ini!</p>
                    <p className="text-[11px] text-muted-foreground">Semua tugas hari ini sudah tuntas atau belum ada jadwal.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {summary.assignmentsToday.map((asg) => (
                      <div
                        key={asg.id}
                        className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border bg-card/60 hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleToggleTask(asg)}
                            className="mt-0.5 text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Circle className="h-4 w-4" />
                          </button>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {asg.title}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                              {asg.course && <span>{asg.course.name}</span>}
                              <span>•</span>
                              <span>{formatUserDateTime(asg.dueDate, timezone)}</span>
                            </div>
                          </div>
                        </div>

                        <Badge
                          variant={asg.priority === 'HIGH' ? 'danger' : asg.priority === 'MEDIUM' ? 'default' : 'secondary'}
                          className="text-[10px] shrink-0"
                        >
                          {asg.priority}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tugas Mendatang (7 Hari ke Depan) */}
            <Card className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-sky-500" />
                    <CardTitle className="text-base font-semibold">Tugas 7 Hari Mendatang</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {summary.assignmentsUpcoming.length} tugas
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                {summary.assignmentsUpcoming.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                    <Calendar className="h-8 w-8 text-sky-500/80 mb-2" />
                    <p className="text-xs font-semibold text-foreground">Tidak ada tugas dalam 7 hari mendatang</p>
                    <p className="text-[11px] text-muted-foreground">Jadwal Anda relatif lengang minggu ini.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {summary.assignmentsUpcoming.map((asg) => (
                      <div
                        key={asg.id}
                        className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border bg-card/60 hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleToggleTask(asg)}
                            className="mt-0.5 text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Circle className="h-4 w-4" />
                          </button>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {asg.title}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                              {asg.course && <span>{asg.course.name}</span>}
                              <span>•</span>
                              <span>{formatUserDateTime(asg.dueDate, timezone)}</span>
                            </div>
                          </div>
                        </div>

                        <Badge
                          variant={asg.priority === 'HIGH' ? 'danger' : asg.priority === 'MEDIUM' ? 'default' : 'secondary'}
                          className="text-[10px] shrink-0"
                        >
                          {asg.priority}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Active Courses Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Mata Kuliah Semester Ini ({summary.activeSemester.name})
                </h3>
                <p className="text-xs text-muted-foreground">
                  {summary.activeCourses.length} mata kuliah aktif terdaftar
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/courses" className="gap-1.5">
                  <span>Semua Mata Kuliah</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {summary.activeCourses.map((c) => (
                <Card key={c.id} className="transition-all hover:border-primary/50 shadow-xs flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base font-semibold truncate">
                        <Link href={`/courses/${c.id}`} className="hover:text-primary transition-colors">
                          {c.name}
                        </Link>
                      </CardTitle>
                      {c.code && (
                        <Badge variant="outline" className="font-mono text-[11px] shrink-0">
                          {c.code}
                        </Badge>
                      )}
                    </div>
                    {c.lecturer && (
                      <CardDescription className="flex items-center gap-1.5 text-xs mt-1">
                        <User className="h-3 w-3" />
                        <span className="truncate">{c.lecturer}</span>
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="border-t border-border pt-2.5">
                      <Button asChild size="sm" variant="ghost" className="w-full justify-between text-xs px-2">
                        <Link href={`/courses/${c.id}`}>
                          <span>Lihat Tugas & Catatan</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Recent Materials Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Materi Kuliah Terkini
                </h3>
                <p className="text-xs text-muted-foreground">
                  File PDF materi kuliah terbaru di semester aktif
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/materials" className="gap-1.5">
                  <span>Semua Materi</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            {(!summary.recentMaterials || summary.recentMaterials.length === 0) ? (
              <Card className="border-dashed p-6 text-center bg-card/40">
                <FileUp className="h-7 w-7 text-muted-foreground mx-auto" />
                <p className="mt-2 text-sm font-semibold text-foreground">Belum ada materi diunggah semester ini</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Unggah file materi PDF kuliah Anda untuk ekstraksi dan referensi belajar.
                </p>
                <Button asChild size="sm" variant="outline" className="mt-3">
                  <Link href="/materials">Buka Halaman Materi</Link>
                </Button>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {summary.recentMaterials.map((m) => (
                  <Card key={m.id} className="p-4 flex flex-col justify-between hover:border-primary/50 transition-colors shadow-xs">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/materials/${m.id}`}
                          className="font-semibold text-foreground hover:text-primary transition-colors text-sm line-clamp-1 flex items-center gap-1.5"
                        >
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <span className="truncate">{m.title}</span>
                        </Link>
                        <MaterialStatusBadge status={m.status} />
                      </div>
                      {m.course && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          <span className="truncate">{m.course.name}</span>
                        </p>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs text-muted-foreground">
                      <span>{formatFileSize(m.bytes)}</span>
                      <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                        <Link href={`/materials/${m.id}`}>
                          Buka
                          <ArrowRight className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
