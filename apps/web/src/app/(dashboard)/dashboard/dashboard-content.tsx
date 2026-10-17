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
import { getProfile } from '@/lib/auth-client';
import { TodayScheduleWidget } from '@/components/dashboard/today-schedule-widget';
import { PinnedItemsWidget } from '@/components/dashboard/pinned-items-widget';
import { DashboardCharts } from '@/components/dashboard/dashboard-charts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AnimatedPanel,
  FadeIn,
  StaggerGroup,
  StaggerItem,
  motion,
} from '@/components/ui/motion';
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
  const [currentUser, setCurrentUser] = React.useState<UserProfile>(user);
  const [summary, setSummary] = React.useState<DashboardSummary | null>(null);
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [activeTaskTab, setActiveTaskTab] = React.useState<string>('today');

  // Per-task pending state and task action error
  const [pendingTaskIds, setPendingTaskIds] = React.useState<Set<string>>(new Set());
  const [taskActionError, setTaskActionError] = React.useState<string | null>(null);

  // Dialog states
  const [isCreateTaskOpen, setIsCreateTaskOpen] = React.useState(false);
  const [isUploadMaterialOpen, setIsUploadMaterialOpen] = React.useState(false);

  // Race condition tracker for semester fetches
  const fetchRequestIdRef = React.useRef(0);

  const timezone = currentUser.timezone || 'Asia/Jakarta';

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

    const handleProfileUpdate = () => {
      getProfile()
        .then((p) => {
          if (p) setCurrentUser(p);
        })
        .catch(console.error);
      loadSummary(true);
    };

    window.addEventListener('studyflow:semester-changed', handleSemesterChange);
    window.addEventListener('studyflow:profile-updated', handleProfileUpdate);
    return () => {
      window.removeEventListener('studyflow:semester-changed', handleSemesterChange);
      window.removeEventListener('studyflow:profile-updated', handleProfileUpdate);
    };
  }, [loadSummary]);

  // Subtask unfinished confirmation
  const [confirmDoneTask, setConfirmDoneTask] = React.useState<Assignment | null>(null);

  // Toggle completion with per-task pending and error isolation
  const executeToggleTask = async (asg: Assignment) => {
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

  const handleToggleTask = (asg: Assignment) => {
    if (
      asg.status !== 'DONE' &&
      asg.subtaskCount &&
      asg.subtaskCount.total > 0 &&
      asg.subtaskCount.completed < asg.subtaskCount.total
    ) {
      setConfirmDoneTask(asg);
      return;
    }
    executeToggleTask(asg);
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

        <Card className="p-8 sm:p-12 text-center max-w-xl mx-auto shadow-xs">
          <CardContent className="p-0">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
              <Calendar className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Mulai dari semester pertamamu</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Pilih atau buat semester aktif untuk mulai mencatat mata kuliah, tugas, dan materi kuliah.
            </p>
            <div className="mt-6 flex justify-center">
              <Button asChild size="standard" className="gap-1.5">
                <Link href="/semesters">
                  <Plus className="h-4 w-4" />
                  <span>Tambah Semester</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
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
            <Button asChild size="standard" className="gap-1.5 self-start sm:self-auto">
              <Link href="/courses">
                <Plus className="h-4 w-4" />
                <span>Tambah Mata Kuliah</span>
              </Link>
            </Button>
          </div>
        </div>

        <Card className="border-dashed bg-card/60 p-8 sm:p-12 text-center max-w-xl mx-auto">
          <CardContent className="p-0">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
              <BookOpen className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Belum ada mata kuliah di semester ini</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Tambahkan mata kuliah yang Anda ambil di {summary.activeSemester.name} untuk menghubungkan tugas dan materi.
            </p>
            <div className="mt-6 flex justify-center">
              <Button asChild size="standard" className="gap-1.5">
                <Link href="/courses">
                  <Plus className="h-4 w-4" />
                  <span>Tambah Mata Kuliah</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderTaskRow = (asg: Assignment) => {
    const isPending = pendingTaskIds.has(asg.id);
    const subtaskPct =
      asg.subtaskCount && asg.subtaskCount.total > 0
        ? Math.round((asg.subtaskCount.completed / asg.subtaskCount.total) * 100)
        : 0;

    return (
      <motion.div
        layout
        key={asg.id}
        className="py-3.5 first:pt-2 last:pb-1 flex items-start justify-between gap-3"
      >
        <div className="flex items-start gap-3 min-w-0 flex-1">
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
          <div className="min-w-0 flex-1">
            <Link
              href="/assignments"
              className={`text-sm font-medium leading-snug block truncate hover:underline ${
                asg.status === 'DONE'
                  ? 'line-through text-muted-foreground'
                  : 'text-foreground hover:text-primary transition-colors'
              }`}
              title={asg.title}
            >
              {asg.title}
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {asg.course && (
                <Badge variant="outline" className="text-xs py-0 px-1.5 font-medium text-foreground/80">
                  {asg.course.name}
                </Badge>
              )}
              <span className="tabular-nums">{formatUserDateTime(asg.dueDate, timezone)}</span>
              {asg.subtaskCount && asg.subtaskCount.total > 0 && (
                <>
                  <span>•</span>
                  <span
                    className="inline-flex items-center gap-1.5 font-medium text-muted-foreground"
                    title={`${asg.subtaskCount.completed} dari ${asg.subtaskCount.total} subtugas selesai`}
                  >
                    <ListTodo className="h-3 w-3 text-primary shrink-0" />
                    <span className="tabular-nums">
                                          {asg.subtaskCount.completed}/{asg.subtaskCount.total}
                    </span>
                    <Progress value={subtaskPct} className="h-1.5 w-12" />
                  </span>
                </>
              )}
              {isPending && (
                <>
                  <span>•</span>
                  <span className="text-primary inline-flex items-center gap-1 text-xs">
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
      </motion.div>
    );
  };

  // 5. Active Dashboard with Content
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header Ringkas */}
      <FadeIn className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3.5 sm:pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-3xl">
            Dashboard
          </h1>
          <div className="mt-0.5 sm:mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{summary.activeSemester.name}</span>
            <span>•</span>
            <span className="tabular-nums">{todayFormatted}</span>
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
            size="standard"
            className="gap-1.5 shrink-0 self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah tugas</span>
          </Button>
        </div>
      </FadeIn>

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

      {/* Kartu Statistik Ringkas dengan <Card> & <Progress> di dalam <StaggerGroup> */}
      <StaggerGroup className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Card 1: Tugas Hari Ini */}
        <StaggerItem>
          <Card className="h-full flex flex-col justify-between">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-medium uppercase tracking-wider">
                  Tugas Hari Ini
                </CardDescription>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                {summary.assignmentsToday.length}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">
                belum selesai • Batas 23.59
              </p>
            </CardContent>
          </Card>
        </StaggerItem>

        {/* Card 2: Tugas Terlambat */}
        <StaggerItem>
          <Card
            className={`h-full flex flex-col justify-between ${
              summary.overdueCount > 0 ? 'border-danger/40 bg-danger/5' : ''
            }`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-medium uppercase tracking-wider">
                  Tugas Terlambat
                </CardDescription>
                <Badge variant={summary.overdueCount > 0 ? 'danger' : 'secondary'}>
                  {summary.overdueCount > 0 ? 'Perlu Tindakan' : 'Aman'}
                </Badge>
              </div>
              <CardTitle
                className={`text-2xl font-bold tracking-tight tabular-nums ${
                  summary.overdueCount > 0 ? 'text-danger-foreground' : 'text-foreground'
                }`}
              >
                {summary.overdueCount}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {summary.overdueCount > 0 ? (
                <Link
                  href="/assignments"
                  className="text-xs text-danger-foreground font-medium hover:underline inline-flex items-center gap-1"
                >
                  <span>Lihat daftar tugas terlambat</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Semua deadline aman
                </p>
              )}
            </CardContent>
          </Card>
        </StaggerItem>

        {/* Card 3: Tugas Selesai */}
        <StaggerItem>
          <Card className="h-full flex flex-col justify-between">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-medium uppercase tracking-wider">
                  Tugas Selesai
                </CardDescription>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success/20 text-success-foreground">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-1.5">
                <CardTitle className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                {summary.completedCount}
                </CardTitle>
                {summary.totalAssignments === 0 ? (
                  <span className="text-xs text-muted-foreground">Belum ada tugas</span>
                ) : (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    dari {summary.totalAssignments} ({summary.completionPercentage}%)
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Progress value={summary.completionPercentage} className="h-2 mt-2" />
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerGroup>

      {/* Tata Letak Konten: Desktop 2/3 Tugas Terdekat + 1/3 Jadwal; Mobile Kolom Tunggal */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3 items-stretch">
        {/* Kolom Utama: Daftar Tugas Akademik / Tugas Terdekat (2/3 Lebar Desktop) */}
        <div className="lg:col-span-2 flex flex-col h-full">
          <Tabs
            defaultValue="today"
            value={activeTaskTab}
            onValueChange={setActiveTaskTab}
            className="flex flex-col flex-1 h-full"
          >
            <Card className="flex flex-col justify-between h-full">
              <div>
                <CardHeader className="border-b border-border/60 pb-3 px-5 sm:px-6 pt-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary shrink-0" />
                      <div>
                        <CardTitle className="text-base font-semibold text-foreground">
                          Daftar Tugas Akademik
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Tugas Terdekat • Semester {summary.activeSemester.name}
                        </CardDescription>
                      </div>
                    </div>

                    <TabsList className="h-9 self-start sm:self-auto">
                      <TabsTrigger value="today" className="gap-1.5 text-xs">
                        <span>Hari Ini</span>
                        <Badge variant="secondary" className="text-xs py-0 px-1.5 font-medium tabular-nums">
                          {summary.assignmentsToday.length}
                        </Badge>
                      </TabsTrigger>
                      <TabsTrigger value="upcoming" className="gap-1.5 text-xs">
                        <span>7 Hari Mendatang</span>
                        <Badge variant="secondary" className="text-xs py-0 px-1.5 font-medium tabular-nums">
                          {summary.assignmentsUpcoming.length}
                        </Badge>
                      </TabsTrigger>
                    </TabsList>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 px-5 sm:px-6 pb-4">
                  {summary.assignmentsToday.length === 0 &&
                  summary.assignmentsUpcoming.length === 0 ? (
                    <div className="py-8 flex flex-col items-center justify-center text-center">
                      {summary.totalAssignments === 0 ? (
                        <>
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground mb-2">
                            <ListTodo className="h-4.5 w-4.5" />
                          </div>
                          <p className="text-sm font-medium text-foreground">
                            Belum ada tugas tercatat
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 max-w-sm leading-relaxed">
                            Catat tugas kuliah baru agar deadline dan prioritas belajar Anda tetap teratur.
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-success/20 text-success-foreground mb-2">
                            <CheckCircle2 className="h-4.5 w-4.5" />
                          </div>
                          <p className="text-sm font-medium text-foreground">
                            Tidak ada deadline dalam 7 hari ke depan
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 max-w-sm leading-relaxed">
                            Semua jadwal terdekat sudah tuntas atau belum ada deadline mendesak minggu ini.
                          </p>
                        </>
                      )}
                    </div>
                  ) : (
                    <AnimatedPanel panelKey={activeTaskTab}>
                      <TabsContent value="today" className="mt-0">
                        {summary.assignmentsToday.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                            <CheckCircle2 className="h-5 w-5 text-success-foreground/70 mb-1.5" />
                            <p className="text-sm font-medium text-foreground">
                              Tidak ada tugas jatuh tempo hari ini
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Semua jadwal hari ini tuntas atau belum ada deadline mendesak.
                            </p>
                          </div>
                        ) : (
                          <div className="divide-y divide-border/60">
                            {summary.assignmentsToday.map((asg) => renderTaskRow(asg))}
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="upcoming" className="mt-0">
                        {summary.assignmentsUpcoming.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                            <Calendar className="h-5 w-5 text-muted-foreground/60 mb-1.5" />
                            <p className="text-sm font-medium text-foreground">
                              Tidak ada tugas dalam 7 hari mendatang
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Jadwal tugas Anda relatif lengang minggu ini.
                            </p>
                          </div>
                        ) : (
                          <div className="divide-y divide-border/60">
                            {summary.assignmentsUpcoming.map((asg) => renderTaskRow(asg))}
                          </div>
                        )}
                      </TabsContent>
                    </AnimatedPanel>
                  )}
                </CardContent>
              </div>

              <CardFooter className="border-t border-border/60 pt-3 pb-4 px-5 sm:px-6 justify-between">
                <span className="text-xs text-muted-foreground">
                  Total aktif: {summary.assignmentsToday.length + summary.assignmentsUpcoming.length} tugas terdekat
                </span>
                <Button asChild variant="ghost" size="sm" className="h-8 px-2.5 text-xs">
                  <Link href="/assignments" className="gap-1">
                    <span>Kelola Semua Tugas</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </Tabs>
        </div>

        {/* Kolom Pendamping: Jadwal Hari Ini (1/3 Lebar Desktop, Bawah Sejajar dengan Tugas) */}
        <div className="lg:col-span-1 flex flex-col">
          <TodayScheduleWidget
            activeSemesterId={summary.activeSemester.id}
            activeSemesterName={summary.activeSemester.name}
            timezone={timezone}
            className="h-full"
          />
        </div>
      </div>

      {/* Bagian Disematkan: Materi & Catatan Penting */}
      <div className="mb-6">
        <PinnedItemsWidget
          activeSemesterId={summary.activeSemester?.id}
          timezone={timezone}
        />
      </div>

      {/* Card Materi Terbaru: Di bawah tugas & jadwal, menggunakan shadcn Card & Table */}
      <Card className="flex flex-col justify-between w-full">
        <div>
          <CardHeader className="border-b border-border/60 pb-3 px-5 sm:px-6 pt-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <div>
                  <CardTitle className="text-base font-semibold text-foreground">
                    Materi Terbaru
                  </CardTitle>
                  <CardDescription className="text-xs">
                    5 dokumen PDF perkuliahan terakhir di semester aktif
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="standard"
                onClick={() => setIsUploadMaterialOpen(true)}
                className="gap-1.5"
              >
                <Upload className="h-4 w-4" />
                <span>Unggah materi</span>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-4 px-5 sm:px-6 pb-4">
            {!summary.recentMaterials || summary.recentMaterials.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-5 sm:py-6 text-center text-muted-foreground">
                <FileText className="h-5 w-5 text-muted-foreground/60 mb-1.5" />
                <p className="text-sm font-medium text-foreground">
                  Belum ada materi semester ini
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">
                  Unggah berkas PDF kuliah untuk ekstraksi ringkasan, flashcard, dan kuis.
                </p>
                <Button
                  size="standard"
                  variant="outline"
                  onClick={() => setIsUploadMaterialOpen(true)}
                  className="mt-3 gap-1.5"
                >
                  <Upload className="h-4 w-4" />
                  <span>Unggah Sekarang</span>
                </Button>
              </div>
            ) : (
              <>
                {/* Desktop & Tablet View (sm:block): shadcn Table */}
                <div className="hidden sm:block rounded-lg border border-border/80 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="text-xs h-9">Judul Materi</TableHead>
                        <TableHead className="text-xs h-9">Mata Kuliah</TableHead>
                        <TableHead className="text-xs h-9">Ukuran</TableHead>
                        <TableHead className="text-xs h-9">Status</TableHead>
                        <TableHead className="text-xs h-9 text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary.recentMaterials.slice(0, 5).map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="py-2.5 font-medium max-w-[260px]">
                            <Link
                              href={`/materials/${m.id}`}
                              className="text-sm font-medium text-foreground hover:text-primary transition-colors block truncate"
                              title={m.title}
                            >
                              {m.title}
                            </Link>
                          </TableCell>
                          <TableCell className="py-2.5 text-xs text-muted-foreground">
                            {m.course ? m.course.name : '-'}
                          </TableCell>
                          <TableCell className="py-2.5 text-xs text-muted-foreground tabular-nums">
                            {formatFileSize(m.bytes)}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <MaterialStatusBadge status={m.status} />
                          </TableCell>
                          <TableCell className="py-2.5 text-right">
                            <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                              <Link href={`/materials/${m.id}`}>
                                Buka
                                <ArrowRight className="ml-1 h-3 w-3" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile View (<640px): Compact Row List */}
                <div className="sm:hidden divide-y divide-border/60">
                  {summary.recentMaterials.slice(0, 5).map((m) => (
                    <div
                      key={m.id}
                      className="py-2.5 first:pt-1 last:pb-1 flex items-start justify-between gap-2.5"
                    >
                      <div className="min-w-0 flex-1 pr-1">
                        <Link
                          href={`/materials/${m.id}`}
                          className="text-sm font-medium text-foreground hover:text-primary transition-colors block truncate"
                          title={m.title}
                        >
                          {m.title}
                        </Link>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                          {m.course && (
                            <span className="truncate max-w-[200px] font-medium text-foreground/80">
                              {m.course.name}
                            </span>
                          )}
                          {m.course && <span>•</span>}
                          <span className="tabular-nums">{formatFileSize(m.bytes)}</span>
                        </div>
                        <div className="mt-1">
                          <MaterialStatusBadge status={m.status} />
                        </div>
                      </div>

                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs shrink-0 self-center"
                      >
                        <Link href={`/materials/${m.id}`}>
                          Buka
                          <ArrowRight className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </div>

        {summary.recentMaterials && summary.recentMaterials.length > 0 && (
          <CardFooter className="border-t border-border/60 pt-3 pb-4 px-5 sm:px-6">
            <Button asChild variant="ghost" size="sm" className="w-full justify-between text-xs px-2 h-8">
              <Link href="/materials">
                <span>Lihat Semua Materi</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Bagian Paling Bawah: Visualisasi Aktivitas Belajar & Beban Tugas (Data Nyata) */}
      <DashboardCharts
        activeSemesterId={summary.activeSemester.id}
        refreshTrigger={fetchRequestIdRef.current}
      />

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

      {/* Confirmation Dialog when completing task with unfinished subtasks */}
      <Dialog
        open={Boolean(confirmDoneTask)}
        onOpenChange={(open) => {
          if (!open) setConfirmDoneTask(null);
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Selesaikan Tugas?</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Tugas &quot;{confirmDoneTask?.title}&quot; memiliki{' '}
              <strong className="text-foreground">
                {(confirmDoneTask?.subtaskCount?.total ?? 0) -
                  (confirmDoneTask?.subtaskCount?.completed ?? 0)}{' '}
                subtugas
              </strong>{' '}
              yang belum selesai. Apakah Anda yakin ingin tetap menandai tugas ini sebagai selesai?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="standard"
              onClick={() => setConfirmDoneTask(null)}
            >
              Batal
            </Button>
            <Button
              type="button"
              size="standard"
              onClick={() => {
                if (confirmDoneTask) {
                  const target = confirmDoneTask;
                  setConfirmDoneTask(null);
                  executeToggleTask(target);
                }
              }}
            >
              Tetap Selesaikan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
