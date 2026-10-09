'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ListTodo,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  FileText,
  Upload,
  ArrowRight,
  Plus,
  RefreshCw,
  AlertCircle,
  Clock,
  BookOpen,
  Loader2,
} from 'lucide-react';
import {
  DashboardSummary,
  UserProfile,
  formatUserDateTime,
  formatFileSize,
  Assignment,
} from '@studyflow/shared';
import { MaterialStatusBadge } from '@/components/materials/material-status-badge';
import { MaterialUploadDialog } from '@/components/materials/material-upload-dialog';
import { CreateTaskDialog } from '@/components/assignments/create-task-dialog';
import { getDashboardSummary } from '@/lib/dashboard-client';
import { updateAssignment } from '@/lib/assignment-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { DashboardSkeleton } from './dashboard-skeleton';

interface DashboardContentProps {
  user: UserProfile;
}

// Indonesian mapping for priority
const PRIORITY_LABELS: Record<string, string> = {
  HIGH: 'Tinggi',
  MEDIUM: 'Sedang',
  LOW: 'Rendah',
};

export function DashboardContent({ user }: DashboardContentProps): React.JSX.Element {
  const [summary, setSummary] = React.useState<DashboardSummary | null>(null);
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  // Per-task pending state and task action error
  const [pendingTaskIds, setPendingTaskIds] = React.useState<Set<string>>(new Set());
  const [taskActionError, setTaskActionError] = React.useState<string | null>(null);

  // Dialog states
  const [isCreateTaskOpen, setIsCreateTaskOpen] = React.useState(false);
  const [isUploadMaterialOpen, setIsUploadMaterialOpen] = React.useState(false);

  // Race condition tracker for semester fetches
  const fetchRequestIdRef = React.useRef(0);

  const timezone = user.timezone || 'Asia/Jakarta';

  // Format today's date in user's profile timezone
  const todayFormatted = React.useMemo(() => {
    try {
      const now = new Date();
      return new Intl.DateTimeFormat('id-ID', {
        timeZone: timezone,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(now);
    } catch {
      return new Date().toLocaleDateString('id-ID');
    }
  }, [timezone]);

  // Load summary with race-condition guard
  const loadSummary = React.useCallback(async (isBackground = false) => {
    const requestId = ++fetchRequestIdRef.current;
    if (isBackground) {
      setIsRefreshing(true);
    } else {
      setInitialLoading(true);
    }
    setFetchError(null);

    try {
      const data = await getDashboardSummary();
      // Only commit data if this is still the latest request
      if (requestId === fetchRequestIdRef.current) {
        setSummary(data);
      }
    } catch (err: any) {
      if (requestId === fetchRequestIdRef.current) {
        setFetchError(err.message || 'Gagal memuat data ringkasan dashboard.');
      }
    } finally {
      if (requestId === fetchRequestIdRef.current) {
        setInitialLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  // Initial load and semester changed event listener
  React.useEffect(() => {
    loadSummary(false);

    const handleSemesterChange = () => {
      // Re-fetch in background without showing full-page skeleton
      loadSummary(true);
    };

    window.addEventListener('studyflow:semester-changed', handleSemesterChange);
    return () => {
      window.removeEventListener('studyflow:semester-changed', handleSemesterChange);
    };
  }, [loadSummary]);

  // Toggle completion with per-task pending and error isolation
  const handleToggleTask = async (asg: Assignment) => {
    if (pendingTaskIds.has(asg.id)) return;

    setPendingTaskIds((prev) => new Set(prev).add(asg.id));
    setTaskActionError(null);

    const nextStatus = asg.status === 'DONE' ? 'TODO' : 'DONE';
    try {
      await updateAssignment(asg.id, { status: nextStatus });
      // Reload summary quietly in background to refresh metrics and lists
      await loadSummary(true);
    } catch (err: any) {
      setTaskActionError(
        `Gagal memperbarui status tugas "${asg.title}": ${err.message || 'Terjadi kesalahan'}`
      );
    } finally {
      setPendingTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(asg.id);
        return next;
      });
    }
  };

  // 1. Initial Loading State: Skeletons matching exact layout
  if (initialLoading) {
    return <DashboardSkeleton />;
  }

  // 2. Error State on initial fetch (distinct from empty states)
  if (fetchError && !summary) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border pb-5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>Terjadi kesalahan saat memuat data</AlertTitle>
          <AlertDescription className="mt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span>{fetchError}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadSummary(false)}
              className="gap-1.5 w-fit"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Coba Lagi</span>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // 3. Empty State A: Belum ada semester aktif
  if (!summary?.activeSemester) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-1 border-b border-border pb-5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{todayFormatted} ({timezone})</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 sm:p-12 text-center max-w-xl mx-auto shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
            <Calendar className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Mulai dari semester pertamamu</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Pilih atau buat semester aktif untuk mulai mencatat mata kuliah, tugas, dan materi kuliah.
          </p>
          <div className="mt-6 flex justify-center">
            <Button asChild className="gap-2">
              <Link href="/semesters">
                <Plus className="h-4 w-4" />
                <span>Tambah Semester</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Empty State B: Semester ada, tetapi belum ada mata kuliah aktif
  if (summary.totalCourses === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-1 border-b border-border pb-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {summary.activeSemester.name} ({summary.activeSemester.academicYear}) • {todayFormatted}
              </p>
            </div>
            <Button asChild size="sm" className="gap-1.5 self-start sm:self-auto">
              <Link href="/courses">
                <Plus className="h-4 w-4" />
                <span>Tambah Mata Kuliah</span>
              </Link>
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-dashed border-border bg-card/60 p-8 sm:p-12 text-center max-w-xl mx-auto">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
            <BookOpen className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Belum ada mata kuliah di semester ini</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Tambahkan mata kuliah yang Anda ambil di {summary.activeSemester.name} untuk menghubungkan tugas dan materi.
          </p>
          <div className="mt-6 flex justify-center">
            <Button asChild className="gap-2">
              <Link href="/courses">
                <Plus className="h-4 w-4" />
                <span>Tambah Mata Kuliah</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 5. Active Dashboard with Content
  return (
    <div className="space-y-6">
      {/* Header Ringkas */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Dashboard
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{summary.activeSemester.name}</span>
            <span>•</span>
            <span>{todayFormatted}</span>
            <span className="text-xs text-muted-foreground">({timezone})</span>
            {isRefreshing && (
              <span className="inline-flex items-center gap-1 text-xs text-primary ml-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Memperbarui...
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsCreateTaskOpen(true)}
            className="gap-2 shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah tugas</span>
          </Button>
        </div>
      </div>

      {/* Background Fetch Error Alert */}
      {fetchError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Pembaruan data terkendala</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{fetchError}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadSummary(true)}
              className="h-7 px-2 text-xs"
            >
              Coba lagi
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Task Action Error Alert */}
      {taskActionError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Aksi tugas gagal</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{taskActionError}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTaskActionError(null)}
              className="h-7 px-2 text-xs"
            >
              Tutup
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Baris Statistik Ringkas (1 Baris) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Stat 1: Hari Ini */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Tugas Hari Ini
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {summary.assignmentsToday.length}
              </span>
              <span className="text-xs text-muted-foreground">belum selesai</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Batas 23.59 ({timezone})
            </p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        {/* Stat 2: Terlambat */}
        <div
          className={`flex items-center justify-between rounded-lg border p-4 transition-colors ${
            summary.overdueCount > 0
              ? 'border-danger/40 bg-danger/5'
              : 'border-border bg-card'
          }`}
        >
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Tugas Terlambat
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span
                className={`text-2xl font-bold tracking-tight ${
                  summary.overdueCount > 0 ? 'text-danger' : 'text-foreground'
                }`}
              >
                {summary.overdueCount}
              </span>
              {summary.overdueCount > 0 ? (
                <Link
                  href="/assignments"
                  className="text-xs text-danger font-medium hover:underline"
                >
                  Lihat daftar →
                </Link>
              ) : (
                <span className="text-xs text-muted-foreground">tenggat terlewat</span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {summary.overdueCount > 0 ? 'Perlu tindakan segera' : 'Semua deadline aman'}
            </p>
          </div>
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              summary.overdueCount > 0
                ? 'bg-danger/20 text-danger'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>

        {/* Stat 3: Selesai */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Tugas Selesai
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {summary.completedCount}
              </span>
              <span className="text-xs text-muted-foreground">
                dari {summary.totalAssignments} ({summary.completionPercentage}%)
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Total semester berjalan
            </p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/15 text-success">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Tata Letak Konten: Desktop 2/3 Tugas + 1/3 Materi; Mobile Kolom Tunggal */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Kolom Utama: Tugas (2/3 Lebar Desktop) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section: Tugas Hari Ini */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <h2 className="text-base font-semibold text-foreground">
                  Tugas Hari Ini
                </h2>
                <Badge variant="outline" className="text-xs ml-1">
                  {summary.assignmentsToday.length}
                </Badge>
              </div>
              <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs">
                <Link href="/assignments" className="gap-1">
                  <span>Semua Tugas</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            <div className="mt-3">
              {summary.assignmentsToday.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-7 text-center text-muted-foreground">
                  <CheckCircle2 className="h-7 w-7 text-emerald-500/80 mb-2" />
                  <p className="text-sm font-medium text-foreground">
                    Tidak ada tugas jatuh tempo hari ini
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Semua jadwal hari ini tuntas atau belum ada deadline mendesak.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {summary.assignmentsToday.map((asg) => {
                    const isPending = pendingTaskIds.has(asg.id);
                    return (
                      <div
                        key={asg.id}
                        className="py-3 first:pt-1 last:pb-1 flex items-start justify-between gap-3"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="pt-0.5">
                            <Checkbox
                              id={`task-${asg.id}`}
                              checked={asg.status === 'DONE'}
                              disabled={isPending}
                              onCheckedChange={() => handleToggleTask(asg)}
                              aria-label={`Tandai tugas ${asg.title} sebagai ${
                                asg.status === 'DONE' ? 'belum selesai' : 'selesai'
                              }`}
                            />
                          </div>
                          <div className="min-w-0">
                            <label
                              htmlFor={`task-${asg.id}`}
                              className={`text-sm font-medium leading-snug cursor-pointer select-none block truncate ${
                                asg.status === 'DONE'
                                  ? 'line-through text-muted-foreground'
                                  : 'text-foreground hover:text-primary transition-colors'
                              }`}
                            >
                              {asg.title}
                            </label>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                              {asg.course && (
                                <span className="font-medium text-foreground/80">
                                  {asg.course.name}
                                </span>
                              )}
                              <span>•</span>
                              <span>{formatUserDateTime(asg.dueDate, timezone)}</span>
                              {isPending && (
                                <>
                                  <span>•</span>
                                  <span className="text-primary inline-flex items-center gap-1 text-[11px]">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Menyimpan...
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <Badge
                          variant={
                            asg.priority === 'HIGH'
                              ? 'danger'
                              : asg.priority === 'MEDIUM'
                              ? 'default'
                              : 'secondary'
                          }
                          className="shrink-0 text-xs py-0.5 px-2"
                        >
                          {PRIORITY_LABELS[asg.priority] || asg.priority}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Section: Tugas Mendatang (7 Hari ke Depan) */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-sky-500" />
                <h2 className="text-base font-semibold text-foreground">
                  Tugas 7 Hari Mendatang
                </h2>
                <Badge variant="outline" className="text-xs ml-1">
                  {summary.assignmentsUpcoming.length}
                </Badge>
              </div>
            </div>

            <div className="mt-3">
              {summary.assignmentsUpcoming.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-7 text-center text-muted-foreground">
                  <Calendar className="h-7 w-7 text-sky-500/80 mb-2" />
                  <p className="text-sm font-medium text-foreground">
                    Tidak ada tugas dalam 7 hari mendatang
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Jadwal tugas Anda relatif lengang minggu ini.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {summary.assignmentsUpcoming.map((asg) => {
                    const isPending = pendingTaskIds.has(asg.id);
                    return (
                      <div
                        key={asg.id}
                        className="py-3 first:pt-1 last:pb-1 flex items-start justify-between gap-3"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="pt-0.5">
                            <Checkbox
                              id={`task-${asg.id}`}
                              checked={asg.status === 'DONE'}
                              disabled={isPending}
                              onCheckedChange={() => handleToggleTask(asg)}
                              aria-label={`Tandai tugas ${asg.title} sebagai ${
                                asg.status === 'DONE' ? 'belum selesai' : 'selesai'
                              }`}
                            />
                          </div>
                          <div className="min-w-0">
                            <label
                              htmlFor={`task-${asg.id}`}
                              className={`text-sm font-medium leading-snug cursor-pointer select-none block truncate ${
                                asg.status === 'DONE'
                                  ? 'line-through text-muted-foreground'
                                  : 'text-foreground hover:text-primary transition-colors'
                              }`}
                            >
                              {asg.title}
                            </label>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                              {asg.course && (
                                <span className="font-medium text-foreground/80">
                                  {asg.course.name}
                                </span>
                              )}
                              <span>•</span>
                              <span>{formatUserDateTime(asg.dueDate, timezone)}</span>
                              {isPending && (
                                <>
                                  <span>•</span>
                                  <span className="text-primary inline-flex items-center gap-1 text-[11px]">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Menyimpan...
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <Badge
                          variant={
                            asg.priority === 'HIGH'
                              ? 'danger'
                              : asg.priority === 'MEDIUM'
                              ? 'default'
                              : 'secondary'
                          }
                          className="shrink-0 text-xs py-0.5 px-2"
                        >
                          {PRIORITY_LABELS[asg.priority] || asg.priority}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Kolom Pendukung: Materi Terbaru (1/3 Lebar Desktop) */}
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <h2 className="text-base font-semibold text-foreground">
                    Materi Terbaru
                  </h2>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsUploadMaterialOpen(true)}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Unggah materi</span>
                </Button>
              </div>

              <div className="mt-3">
                {!summary.recentMaterials || summary.recentMaterials.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                    <FileText className="h-7 w-7 text-muted-foreground/60 mb-2" />
                    <p className="text-sm font-medium text-foreground">
                      Belum ada materi semester ini
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">
                      Unggah berkas PDF kuliah untuk ekstraksi ringkasan, flashcard, dan kuis.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsUploadMaterialOpen(true)}
                      className="mt-4 gap-1.5 text-xs"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>Unggah Sekarang</span>
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {summary.recentMaterials.slice(0, 5).map((m) => (
                      <div
                        key={m.id}
                        className="py-3 first:pt-1 last:pb-1 flex items-start justify-between gap-2"
                      >
                        <div className="min-w-0 pr-1">
                          <Link
                            href={`/materials/${m.id}`}
                            className="text-sm font-medium text-foreground hover:text-primary transition-colors block truncate"
                            title={m.title}
                          >
                            {m.title}
                          </Link>
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            {m.course && <span className="truncate max-w-[130px]">{m.course.name}</span>}
                            <span>•</span>
                            <span>{formatFileSize(m.bytes)}</span>
                          </div>
                          <div className="mt-1.5">
                            <MaterialStatusBadge status={m.status} />
                          </div>
                        </div>

                        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs shrink-0 self-center">
                          <Link href={`/materials/${m.id}`}>
                            Buka
                            <ArrowRight className="ml-1 h-3 w-3" />
                          </Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {summary.recentMaterials && summary.recentMaterials.length > 0 && (
              <div className="mt-4 pt-3 border-t border-border">
                <Button asChild variant="ghost" size="sm" className="w-full justify-between text-xs px-2">
                  <Link href="/materials">
                    <span>Lihat Semua Materi</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Dialog: Tambah Tugas */}
      <CreateTaskDialog
        open={isCreateTaskOpen}
        onOpenChange={setIsCreateTaskOpen}
        courses={summary.activeCourses}
        timezone={timezone}
        idPrefix="task"
        onSuccess={() => {
          loadSummary(true);
        }}
      />

      {/* Modal Dialog: Unggah Materi */}
      <MaterialUploadDialog
        open={isUploadMaterialOpen}
        onOpenChange={setIsUploadMaterialOpen}
        courses={summary.activeCourses}
        onSuccess={() => {
          loadSummary(true);
        }}
      />
    </div>
  );
}
