'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ListTodo,
  Plus,
  Search,
  BookOpen,
  ArrowUpDown,
  Clock,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Pencil,
  Trash2,
  MoreVertical,
  RotateCcw,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import {
  Assignment,
  Course,
  Semester,
  UserProfile,
  formatUserDateTime,
  getUserTodayRange,
} from '@studyflow/shared';
import {
  listAssignments,
  updateAssignment,
} from '@/lib/assignment-client';
import { listCourses } from '@/lib/course-client';
import { listSemesters } from '@/lib/semester-client';
import { getProfile } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  RadixSelect as Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { CreateTaskDialog } from '@/components/assignments/create-task-dialog';
import { EditTaskDialog } from '@/components/assignments/edit-task-dialog';
import { DeleteTaskDialog } from '@/components/assignments/delete-task-dialog';

function getDeadlineStatusInfo(asg: Assignment, timezone: string) {
  if (asg.status === 'DONE') {
    return {
      type: 'DONE' as const,
      label: 'Selesai',
      icon: CheckCircle2,
      badgeClass:
        'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
    };
  }

  if (asg.isOverdue) {
    return {
      type: 'OVERDUE' as const,
      label: 'Terlambat',
      icon: AlertTriangle,
      badgeClass:
        'bg-destructive/10 text-destructive border border-destructive/20 font-semibold',
    };
  }

  try {
    const { startOfToday, endOfToday } = getUserTodayRange(new Date(), timezone);
    const dueTime = new Date(asg.dueDate).getTime();
    if (dueTime >= startOfToday.getTime() && dueTime <= endOfToday.getTime()) {
      return {
        type: 'TODAY' as const,
        label: 'Hari ini',
        icon: Clock,
        badgeClass:
          'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-medium',
      };
    }
  } catch {
    // fallback if calculation fails
  }

  return {
    type: 'UPCOMING' as const,
    label: 'Mendatang',
    icon: Calendar,
    badgeClass: 'bg-muted/80 text-muted-foreground border border-border',
  };
}

export default function AssignmentsPage(): React.JSX.Element {
  const [assignments, setAssignments] = React.useState<Assignment[]>([]);
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [activeSemester, setActiveSemester] = React.useState<Semester | null>(null);
  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [selectedCourseId, setSelectedCourseId] = React.useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = React.useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = React.useState<string>('ALL');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('asc');
  const [isOverdueOnly, setIsOverdueOnly] = React.useState<boolean>(false);

  // Page States
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [pendingTaskIds, setPendingTaskIds] = React.useState<Set<string>>(new Set());

  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [editingAssignment, setEditingAssignment] = React.useState<Assignment | null>(null);
  const [deletingAssignment, setDeletingAssignment] = React.useState<Assignment | null>(null);

  const timezone = userProfile?.timezone || 'Asia/Jakarta';

  // Request race condition prevention
  const fetchRequestIdRef = React.useRef(0);

  // Load initial metadata: Profile, Courses & Semester
  React.useEffect(() => {
    let isMounted = true;
    async function loadMeta() {
      try {
        const [profile, courseRes, semesterRes] = await Promise.all([
          getProfile().catch(() => null),
          listCourses().catch(() => ({ courses: [] })),
          listSemesters().catch(() => ({ semesters: [], activeSemester: null, activeSemesterId: null })),
        ]);
        if (!isMounted) return;
        if (profile) setUserProfile(profile);
        setCourses(courseRes.courses);
        if (semesterRes?.activeSemester) setActiveSemester(semesterRes.activeSemester);
      } catch (err) {
        console.error('Failed to load metadata:', err);
      }
    }
    loadMeta();

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch Assignments function
  const fetchAssignmentsList = React.useCallback(
    async (silent = false) => {
      const currentRequestId = ++fetchRequestIdRef.current;
      if (!silent) {
        setIsLoading(true);
      }
      setErrorMsg(null);

      try {
        const data = await listAssignments({
          courseId: selectedCourseId === 'ALL' ? undefined : selectedCourseId,
          status: selectedStatus === 'ALL' ? undefined : (selectedStatus as any),
          priority: selectedPriority === 'ALL' ? undefined : (selectedPriority as any),
          isOverdue: isOverdueOnly ? true : undefined,
          search: searchQuery.trim() || undefined,
          sortBy: 'dueDate',
          sortOrder,
          limit: 100,
        });

        // Ensure we only process the latest request to avoid race condition
        if (currentRequestId === fetchRequestIdRef.current) {
          setAssignments(data.assignments);
        }
      } catch (err: any) {
        if (currentRequestId === fetchRequestIdRef.current) {
          setErrorMsg(err.message || 'Gagal memuat daftar tugas kuliah.');
        }
      } finally {
        if (currentRequestId === fetchRequestIdRef.current && !silent) {
          setIsLoading(false);
        }
      }
    },
    [
      selectedCourseId,
      selectedStatus,
      selectedPriority,
      isOverdueOnly,
      searchQuery,
      sortOrder,
    ]
  );

  React.useEffect(() => {
    fetchAssignmentsList();
  }, [fetchAssignmentsList]);

  // Semester change listener
  React.useEffect(() => {
    const handleSemesterChange = () => {
      listCourses().then((res) => setCourses(res.courses)).catch(() => {});
      listSemesters().then((res) => setActiveSemester(res.activeSemester)).catch(() => {});
      fetchAssignmentsList(true);
    };
    window.addEventListener('studyflow:semester-changed', handleSemesterChange);

    return () => {
      window.removeEventListener('studyflow:semester-changed', handleSemesterChange);
    };
  }, [fetchAssignmentsList]);

  // Checkbox Toggle Status with optimistic rollback
  const handleToggleStatus = async (asg: Assignment) => {
    const isDone = asg.status === 'DONE';
    const nextStatus = isDone ? 'TODO' : 'DONE';
    setActionError(null);

    // Prevent double clicking
    setPendingTaskIds((prev) => new Set(prev).add(asg.id));

    // Optimistically update UI
    setAssignments((prev) =>
      prev.map((item) =>
        item.id === asg.id
          ? {
              ...item,
              status: nextStatus,
              completedAt: nextStatus === 'DONE' ? new Date().toISOString() : null,
            }
          : item
      )
    );

    try {
      await updateAssignment(asg.id, { status: nextStatus });
      // Silent refetch to sync server state
      await fetchAssignmentsList(true);
    } catch (err: any) {
      // Revert optimistic update on error
      setAssignments((prev) =>
        prev.map((item) => (item.id === asg.id ? asg : item))
      );
      setActionError(err.message || 'Gagal memperbarui status tugas.');
    } finally {
      setPendingTaskIds((prev) => {
        const updated = new Set(prev);
        updated.delete(asg.id);
        return updated;
      });
    }
  };

  const activeCourses = React.useMemo(
    () => courses.filter((c) => !c.archivedAt),
    [courses]
  );

  const hasFilter = Boolean(
    searchQuery ||
      selectedCourseId !== 'ALL' ||
      selectedStatus !== 'ALL' ||
      selectedPriority !== 'ALL' ||
      isOverdueOnly ||
      sortOrder !== 'asc'
  );

  const handleResetFilter = () => {
    setSearchQuery('');
    setSelectedCourseId('ALL');
    setSelectedStatus('ALL');
    setSelectedPriority('ALL');
    setIsOverdueOnly(false);
    setSortOrder('asc');
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 1. Header Halaman */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3.5 sm:pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-3xl">
            Tugas
          </h1>
          <div className="mt-0.5 sm:mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-muted-foreground">
            {activeSemester ? (
              <>
                <span className="font-medium text-foreground">
                  {activeSemester.name.toLowerCase().includes(activeSemester.academicYear.toLowerCase())
                    ? activeSemester.name
                    : `${activeSemester.name} (${activeSemester.academicYear})`}
                </span>
                <span>•</span>
              </>
            ) : null}
            <span>{assignments.length} tugas terdaftar</span>
          </div>
        </div>

        <Button
          onClick={() => setIsCreateOpen(true)}
          disabled={activeCourses.length === 0}
          size="standard"
          className="gap-1.5 shrink-0 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Tambah tugas</span>
        </Button>
      </div>

      {/* Warning banner jika belum ada mata kuliah aktif */}
      {activeCourses.length === 0 && !isLoading && (
        <Alert variant="warning">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>Belum ada mata kuliah aktif</AlertTitle>
          <AlertDescription className="mt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span>
              Anda perlu menambahkan mata kuliah aktif terlebih dahulu sebelum dapat mencatat tugas kuliah.
            </span>
            <Button asChild variant="outline" size="sm" className="w-fit">
              <Link href="/courses">Kelola Mata Kuliah &rarr;</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Local Action Error Feedback */}
      {actionError && (
        <Alert variant="destructive">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>Aksi tugas belum berhasil</AlertTitle>
          <AlertDescription className="mt-1 flex items-center justify-between gap-3">
            <span>{actionError}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActionError(null)}
              className="h-8 px-2 text-xs"
            >
              Tutup
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* 2. Pencarian dan Filter Toolbar Terpadu */}
      <Card className="border border-border shadow-xs">
        <CardContent className="p-3.5 sm:p-4">
          <div className="flex flex-col gap-3">
            {/* Baris 1: Pencarian & Reset */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Cari judul tugas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>

              {hasFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilter}
                  className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground shrink-0 self-start sm:self-auto"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  <span>Hapus filter</span>
                </Button>
              )}
            </div>

            {/* Baris 2: Dropdown Filter & Toggles */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Filter Mata Kuliah */}
              <div className="w-full sm:w-[200px]">
                <Select
                  value={selectedCourseId}
                  onValueChange={(val) => setSelectedCourseId(val)}
                >
                  <SelectTrigger className="h-9 text-xs sm:text-sm">
                    <SelectValue placeholder="Semua Mata Kuliah" />
                  </SelectTrigger>
                  <SelectContent className="max-w-[calc(100vw-2rem)] sm:max-w-[320px]">
                    <SelectItem value="ALL">Semua Mata Kuliah</SelectItem>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.code ? `(${c.code})` : ''} {c.archivedAt ? '[Arsip]' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filter Status */}
              <div className="w-[calc(50%-0.25rem)] sm:w-[160px]">
                <Select
                  value={selectedStatus}
                  onValueChange={(val) => setSelectedStatus(val)}
                >
                  <SelectTrigger className="h-9 text-xs sm:text-sm">
                    <SelectValue placeholder="Semua Status" />
                  </SelectTrigger>
                  <SelectContent className="max-w-[calc(100vw-2rem)] sm:max-w-[220px]">
                    <SelectItem value="ALL">Semua Status</SelectItem>
                    <SelectItem value="TODO">Belum Dikerjakan</SelectItem>
                    <SelectItem value="IN_PROGRESS">Sedang Dikerjakan</SelectItem>
                    <SelectItem value="DONE">Selesai</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filter Prioritas */}
              <div className="w-[calc(50%-0.25rem)] sm:w-[150px]">
                <Select
                  value={selectedPriority}
                  onValueChange={(val) => setSelectedPriority(val)}
                >
                  <SelectTrigger className="h-9 text-xs sm:text-sm">
                    <SelectValue placeholder="Semua Prioritas" />
                  </SelectTrigger>
                  <SelectContent className="max-w-[calc(100vw-2rem)] sm:max-w-[200px]">
                    <SelectItem value="ALL">Semua Prioritas</SelectItem>
                    <SelectItem value="HIGH">Tinggi</SelectItem>
                    <SelectItem value="MEDIUM">Sedang</SelectItem>
                    <SelectItem value="LOW">Rendah</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Toggle Overdue & Sort Order */}
              <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
                <Button
                  variant={isOverdueOnly ? 'destructive' : 'outline'}
                  size="icon-sm"
                  onClick={() => setIsOverdueOnly(!isOverdueOnly)}
                  title={isOverdueOnly ? 'Tampilkan semua tenggat waktu' : 'Hanya tampilkan tugas terlambat'}
                  aria-label="Filter tugas terlambat"
                  className="h-9 w-9 shrink-0 relative after:absolute after:-inset-1 sm:after:hidden touch-manipulation"
                >
                  <Clock className="h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  title={`Urutkan deadline: ${sortOrder === 'asc' ? 'Terdekat dahulu' : 'Terjauh dahulu'}`}
                  aria-label={`Urutan deadline: ${sortOrder === 'asc' ? 'Terdekat dahulu' : 'Terjauh dahulu'}`}
                  className="h-9 w-9 shrink-0 relative after:absolute after:-inset-1 sm:after:hidden touch-manipulation"
                >
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Daftar Tugas & State Views */}
      {isLoading ? (
        /* Loading Skeleton State */
        <div className="space-y-3" data-testid="assignments-skeleton">
          {/* Skeleton Desktop Table */}
          <div className="hidden md:block rounded-xl border border-border bg-card p-4 space-y-3">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
          {/* Skeleton Mobile Cards */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
        </div>
      ) : errorMsg ? (
        /* Error State with Retry Button */
        <Alert variant="destructive">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>Terjadi kesalahan saat memuat tugas</AlertTitle>
          <AlertDescription className="mt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span>{errorMsg}</span>
            <Button
              variant="outline"
              size="standard"
              onClick={() => fetchAssignmentsList()}
              className="gap-1.5 w-fit"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Coba Lagi</span>
            </Button>
          </AlertDescription>
        </Alert>
      ) : assignments.length === 0 ? (
        /* Empty State */
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 sm:p-12 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
            <ListTodo className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            {hasFilter ? 'Tidak ada tugas yang cocok' : 'Belum ada tugas kuliah'}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            {hasFilter
              ? 'Coba atur ulang kata kunci pencarian atau sesuaikan filter mata kuliah, status, dan prioritas.'
              : 'Mulai dengan menambahkan tugas baru agar Anda dapat memantau tenggat waktu dan progres belajar.'}
          </p>
          {hasFilter ? (
            <Button
              variant="outline"
              size="standard"
              onClick={handleResetFilter}
              className="mt-4"
            >
              Hapus filter
            </Button>
          ) : (
            <Button
              size="standard"
              onClick={() => setIsCreateOpen(true)}
              disabled={activeCourses.length === 0}
              className="mt-4 gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah tugas</span>
            </Button>
          )}
        </div>
      ) : (
        /* Data Loaded View: Desktop Table + Mobile Cards */
        <div className="space-y-4">
          {/* Desktop Table View (>= 768px) */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3.5 w-12 text-center">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3.5">
                      Judul Tugas
                    </th>
                    <th scope="col" className="px-4 py-3.5">
                      Mata Kuliah
                    </th>
                    <th scope="col" className="px-4 py-3.5">
                      Tenggat Waktu
                    </th>
                    <th scope="col" className="px-4 py-3.5">
                      Prioritas
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-right w-14">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {assignments.map((asg) => {
                    const isDone = asg.status === 'DONE';
                    const isArchived = Boolean(
                      asg.course?.archivedAt || asg.course?.semester?.archivedAt
                    );
                    const isPending = pendingTaskIds.has(asg.id);
                    const deadlineInfo = getDeadlineStatusInfo(asg, timezone);
                    const DeadlineIcon = deadlineInfo.icon;

                    return (
                      <tr
                        key={asg.id}
                        className={`hover:bg-muted/30 transition-colors ${
                          isDone ? 'bg-muted/10 opacity-75' : ''
                        }`}
                      >
                        {/* Status Checkbox */}
                        <td className="px-4 py-3.5 text-center align-top pt-4">
                          <div className="flex items-center justify-center">
                            {isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            ) : (
                              <Checkbox
                                id={`task-check-${asg.id}`}
                                checked={isDone}
                                disabled={isArchived || isPending}
                                onCheckedChange={() => handleToggleStatus(asg)}
                                aria-label={
                                  isDone
                                    ? `Tandai tugas "${asg.title}" belum selesai`
                                    : `Tandai tugas "${asg.title}" selesai`
                                }
                              />
                            )}
                          </div>
                        </td>

                        {/* Judul Tugas & Deskripsi */}
                        <td className="px-4 py-3.5 align-top">
                          <div className="flex flex-col min-w-0 max-w-[360px]">
                            <span
                              className={`font-medium text-sm break-words ${
                                isDone
                                  ? 'line-through text-muted-foreground'
                                  : 'text-foreground'
                              }`}
                            >
                              {asg.title}
                            </span>
                            {asg.description && (
                              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 break-words">
                                {asg.description}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Mata Kuliah */}
                        <td className="px-4 py-3.5 align-top whitespace-nowrap">
                          {asg.course ? (
                            <div className="flex items-center gap-1.5">
                              <Link
                                href={`/courses/${asg.course.id}`}
                                className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline flex items-center gap-1.5"
                                title={asg.course.name}
                              >
                                <BookOpen className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate max-w-[180px]">
                                  {asg.course.name}
                                </span>
                              </Link>
                              {isArchived && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] py-0 px-1 border-muted"
                                >
                                  Arsip
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Mata Kuliah</span>
                          )}
                        </td>

                        {/* Tenggat Waktu & Penanda Status */}
                        <td className="px-4 py-3.5 align-top whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-foreground font-medium">
                              {formatUserDateTime(asg.dueDate, timezone)}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] ${deadlineInfo.badgeClass}`}
                              >
                                <DeadlineIcon className="h-3 w-3 shrink-0" />
                                <span>{deadlineInfo.label}</span>
                              </span>
                            </div>
                            {isDone && asg.completedAt && (
                              <span className="text-[11px] text-muted-foreground">
                                Selesai: {formatUserDateTime(asg.completedAt, timezone)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Prioritas */}
                        <td className="px-4 py-3.5 align-top whitespace-nowrap">
                          <Badge
                            variant={
                              asg.priority === 'HIGH'
                                ? 'danger'
                                : asg.priority === 'MEDIUM'
                                ? 'default'
                                : 'secondary'
                            }
                            className="text-xs"
                          >
                            {asg.priority === 'HIGH'
                              ? 'Tinggi'
                              : asg.priority === 'MEDIUM'
                              ? 'Sedang'
                              : 'Rendah'}
                          </Badge>
                        </td>

                        {/* Aksi Dropdown */}
                        <td className="px-4 py-3.5 align-top text-right whitespace-nowrap">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="h-8 w-8 relative after:absolute after:-inset-1.5 sm:after:hidden touch-manipulation text-muted-foreground hover:text-foreground"
                                aria-label={`Menu aksi untuk tugas "${asg.title}"`}
                                disabled={isArchived}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem
                                onClick={() => setEditingAssignment(asg)}
                                disabled={isArchived}
                                className="cursor-pointer"
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                <span>Edit tugas</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeletingAssignment(asg)}
                                disabled={isArchived}
                                className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                <span>Hapus tugas</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card List (< 768px) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {assignments.map((asg) => {
              const isDone = asg.status === 'DONE';
              const isArchived = Boolean(
                asg.course?.archivedAt || asg.course?.semester?.archivedAt
              );
              const isPending = pendingTaskIds.has(asg.id);
              const deadlineInfo = getDeadlineStatusInfo(asg, timezone);
              const DeadlineIcon = deadlineInfo.icon;

              return (
                <Card
                  key={asg.id}
                  className={`p-3.5 transition-colors ${
                    isDone ? 'bg-muted/20 opacity-80' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox Status */}
                    <div className="pt-0.5 shrink-0">
                      {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : (
                        <Checkbox
                          id={`mob-task-check-${asg.id}`}
                          checked={isDone}
                          disabled={isArchived || isPending}
                          onCheckedChange={() => handleToggleStatus(asg)}
                          aria-label={
                            isDone
                              ? `Tandai tugas "${asg.title}" belum selesai`
                              : `Tandai tugas "${asg.title}" selesai`
                          }
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Title & Priority Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <h4
                          className={`text-sm font-semibold leading-snug break-words flex-1 min-w-0 ${
                            isDone
                              ? 'line-through text-muted-foreground'
                              : 'text-foreground'
                          }`}
                        >
                          {asg.title}
                        </h4>
                        <Badge
                          variant={
                            asg.priority === 'HIGH'
                              ? 'danger'
                              : asg.priority === 'MEDIUM'
                              ? 'default'
                              : 'secondary'
                          }
                          className="text-[10px] shrink-0"
                        >
                          {asg.priority === 'HIGH'
                            ? 'Tinggi'
                            : asg.priority === 'MEDIUM'
                            ? 'Sedang'
                            : 'Rendah'}
                        </Badge>
                      </div>

                      {/* Course */}
                      {asg.course && (
                        <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1.5">
                          <BookOpen className="h-3 w-3 shrink-0" />
                          <span className="truncate">{asg.course.name}</span>
                        </p>
                      )}

                      {/* Description */}
                      {asg.description && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2 break-words">
                          {asg.description}
                        </p>
                      )}

                      {/* Card Footer: Due Date & Actions */}
                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2.5">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-foreground font-medium">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span>{formatUserDateTime(asg.dueDate, timezone)}</span>
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] ${deadlineInfo.badgeClass}`}
                          >
                            <DeadlineIcon className="h-2.5 w-2.5 shrink-0" />
                            <span>{deadlineInfo.label}</span>
                          </span>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="h-8 w-8 relative after:absolute after:-inset-1.5 sm:after:hidden touch-manipulation text-muted-foreground hover:text-foreground shrink-0"
                              aria-label={`Menu aksi untuk tugas "${asg.title}"`}
                              disabled={isArchived}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              onClick={() => setEditingAssignment(asg)}
                              disabled={isArchived}
                              className="cursor-pointer"
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              <span>Edit tugas</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeletingAssignment(asg)}
                              disabled={isArchived}
                              className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              <span>Hapus tugas</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Dialog Create Assignment */}
      <CreateTaskDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        courses={courses}
        timezone={timezone}
        onSuccess={() => {
          fetchAssignmentsList(true);
        }}
      />

      {/* Dialog Edit Assignment */}
      <EditTaskDialog
        open={Boolean(editingAssignment)}
        onOpenChange={(open) => !open && setEditingAssignment(null)}
        assignment={editingAssignment}
        timezone={timezone}
        onSuccess={() => {
          setEditingAssignment(null);
          fetchAssignmentsList(true);
        }}
      />

      {/* Dialog Delete Assignment */}
      <DeleteTaskDialog
        open={Boolean(deletingAssignment)}
        onOpenChange={(open) => !open && setDeletingAssignment(null)}
        assignment={deletingAssignment}
        onSuccess={() => {
          setDeletingAssignment(null);
          fetchAssignmentsList(true);
        }}
      />
    </div>
  );
}
