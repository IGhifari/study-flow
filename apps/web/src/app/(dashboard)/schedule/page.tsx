'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  CalendarClock,
  Plus,
  RotateCcw,
  Pencil,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  User,
  Clock,
  MapPin,
  MoreVertical,
  CalendarRange,
  Globe,
  Info,
} from 'lucide-react';
import {
  Course,
  Semester,
  UserProfile,
  CourseSchedule,
  CourseScheduleConflict,
  DAY_NAMES_ID,
  getDayNameId,
} from '@studyflow/shared';
import { listSchedules } from '@/lib/schedule-client';
import { listCourses } from '@/lib/course-client';
import { listSemesters } from '@/lib/semester-client';
import { getProfile } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  RadixSelect as Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CreateScheduleDialog } from '@/components/schedules/create-schedule-dialog';
import { EditScheduleDialog } from '@/components/schedules/edit-schedule-dialog';
import { DeleteScheduleDialog } from '@/components/schedules/delete-schedule-dialog';

function getCurrentDayOfWeekInTimezone(timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
    });
    const weekdayStr = formatter.format(new Date());
    const dayMap: Record<string, number> = {
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
      Sun: 7,
    };
    return dayMap[weekdayStr] || 1;
  } catch {
    return 1;
  }
}

export default function SchedulePage(): React.JSX.Element {
  const searchParams = useSearchParams();
  const initialCourseId = searchParams.get('courseId') || 'all';
  const querySemesterId = searchParams.get('semesterId');

  const [semesters, setSemesters] = React.useState<Semester[]>([]);
  const [activeSemester, setActiveSemester] = React.useState<Semester | null>(null);
  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);

  const [courses, setCourses] = React.useState<Course[]>([]);
  const [schedules, setSchedules] = React.useState<CourseSchedule[]>([]);

  // Filters
  const [selectedCourseFilter, setSelectedCourseFilter] = React.useState<string>(initialCourseId);

  // Mobile selected day (1..7, default based on user timezone)
  const [mobileSelectedDay, setMobileSelectedDay] = React.useState<number>(1);

  // Loading & Error States
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Success / Conflict Banner from dialog action
  const [statusBanner, setStatusBanner] = React.useState<{
    type: 'success' | 'warning';
    message: string;
    conflicts?: CourseScheduleConflict[];
  } | null>(null);

  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [editingSchedule, setEditingSchedule] = React.useState<CourseSchedule | null>(null);
  const [deletingSchedule, setDeletingSchedule] = React.useState<CourseSchedule | null>(null);

  // Race condition guard
  const fetchRequestIdRef = React.useRef(0);

  const timezone = userProfile?.timezone || 'Asia/Jakarta';

  // 1. Initial Load: Profile & Semesters
  React.useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const [profile, semData] = await Promise.all([
          getProfile().catch(() => null),
          listSemesters('all'),
        ]);
        if (!isMounted) return;
        if (profile) {
          setUserProfile(profile);
          const currentDay = getCurrentDayOfWeekInTimezone(profile.timezone || 'Asia/Jakarta');
          setMobileSelectedDay(currentDay);
        }
        setSemesters(semData.semesters);
        const resolvedSemester = querySemesterId
          ? semData.semesters.find((s) => s.id === querySemesterId) || semData.activeSemester
          : semData.activeSemester;
        setActiveSemester(resolvedSemester);
      } catch (err) {
        console.error('Failed to load initial schedule context:', err);
      }
    }
    init();

    const handleSemesterChange = () => {
      listSemesters('all')
        .then((semData) => {
          if (!isMounted) return;
          setSemesters(semData.semesters);
          setActiveSemester(semData.activeSemester);
        })
        .catch(console.error);
    };

    window.addEventListener('studyflow:semester-changed', handleSemesterChange);
    return () => {
      isMounted = false;
      window.removeEventListener('studyflow:semester-changed', handleSemesterChange);
    };
  }, [querySemesterId]);

  // 2. Fetch Schedules & Courses for active semester
  const fetchScheduleData = React.useCallback(async (targetSemester: Semester | null) => {
    if (!targetSemester) {
      setCourses([]);
      setSchedules([]);
      setIsLoading(false);
      return;
    }

    const currentRequestId = ++fetchRequestIdRef.current;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const [crsRes, schRes] = await Promise.all([
        listCourses({ semesterId: targetSemester.id, isArchived: false }),
        listSchedules({ semesterId: targetSemester.id }),
      ]);

      // Guard against race conditions: ignore response if a newer request was dispatched
      if (currentRequestId === fetchRequestIdRef.current) {
        setCourses(crsRes.courses);
        setSchedules(schRes.schedules);
      }
    } catch (err: any) {
      if (currentRequestId === fetchRequestIdRef.current) {
        setErrorMsg(err.message || 'Gagal memuat jadwal kuliah');
      }
    } finally {
      if (currentRequestId === fetchRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  React.useEffect(() => {
    fetchScheduleData(activeSemester);
  }, [activeSemester, fetchScheduleData]);

  // Synchronize initial courseId from query param if available
  React.useEffect(() => {
    if (initialCourseId && initialCourseId !== 'all') {
      setSelectedCourseFilter(initialCourseId);
    }
  }, [initialCourseId]);

  // Filter schedules by selected course
  const filteredSchedules = React.useMemo(() => {
    if (selectedCourseFilter === 'all') return schedules;
    return schedules.filter((s) => s.courseId === selectedCourseFilter);
  }, [schedules, selectedCourseFilter]);

  // Group schedules by day of week (1..7)
  const schedulesByDay = React.useMemo(() => {
    const map: Record<number, CourseSchedule[]> = {
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
      7: [],
    };
    for (const item of filteredSchedules) {
      if (map[item.dayOfWeek]) {
        map[item.dayOfWeek].push(item);
      }
    }
    // Sort each day by startTime ascending
    for (let day = 1; day <= 7; day++) {
      map[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [filteredSchedules]);

  // Handler Dialog Callbacks
  const handleCreateSuccess = (
    newSchedule: CourseSchedule,
    hasConflict: boolean,
    conflicts?: CourseScheduleConflict[]
  ) => {
    fetchScheduleData(activeSemester);
    if (hasConflict && conflicts && conflicts.length > 0) {
      const conflictNames = conflicts.map((c) => `${c.courseName} (${c.startTime}–${c.endTime})`).join(', ');
      setStatusBanner({
        type: 'warning',
        message: `Jadwal disimpan, tetapi waktunya bertabrakan dengan: ${conflictNames}.`,
        conflicts,
      });
    } else {
      setStatusBanner({
        type: 'success',
        message: 'Jadwal perkuliahan berhasil ditambahkan.',
      });
    }
  };

  const handleEditSuccess = (
    updatedSchedule: CourseSchedule,
    hasConflict: boolean,
    conflicts?: CourseScheduleConflict[]
  ) => {
    fetchScheduleData(activeSemester);
    if (hasConflict && conflicts && conflicts.length > 0) {
      const conflictNames = conflicts.map((c) => `${c.courseName} (${c.startTime}–${c.endTime})`).join(', ');
      setStatusBanner({
        type: 'warning',
        message: `Jadwal diperbarui, tetapi waktunya bertabrakan dengan: ${conflictNames}.`,
        conflicts,
      });
    } else {
      setStatusBanner({
        type: 'success',
        message: 'Jadwal perkuliahan berhasil diperbarui.',
      });
    }
  };

  const handleDeleteSuccess = () => {
    fetchScheduleData(activeSemester);
    setStatusBanner({
      type: 'success',
      message: 'Jadwal perkuliahan berhasil dihapus.',
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Ringkas */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Jadwal Kuliah
            </h1>
            {activeSemester ? (
              <Badge variant="outline" className="font-medium text-xs">
                {activeSemester.name}
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs text-muted-foreground">
                Belum Ada Semester Aktif
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-muted-foreground/70" />
              <span>Sesi mingguan berulang</span>
            </span>
            <span>&bull;</span>
            <span className="flex items-center gap-1">
              <Globe className="h-3.5 w-3.5 text-muted-foreground/70" />
              <span>Zona Waktu: <strong className="text-foreground font-medium">{timezone}</strong></span>
            </span>
          </div>
        </div>

        {/* CTA Tambah Jadwal */}
        <div>
          <Button
            onClick={() => {
              setStatusBanner(null);
              setIsCreateOpen(true);
            }}
            disabled={!activeSemester || courses.length === 0}
            size="standard"
            className="gap-1.5 w-full sm:w-auto font-medium"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Jadwal</span>
          </Button>
        </div>
      </div>

      {/* 2. Status / Conflict Feedback Banner */}
      {statusBanner && (
        <Alert
          variant={statusBanner.type === 'warning' ? 'warning' : 'default'}
          className={statusBanner.type === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100' : ''}
        >
          {statusBanner.type === 'warning' ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <Info className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          )}
          <div className="flex-1">
            <AlertTitle className="text-sm font-semibold">
              {statusBanner.type === 'warning' ? 'Peringatan Benturan Jadwal' : 'Berhasil'}
            </AlertTitle>
            <AlertDescription className="text-xs leading-relaxed mt-0.5">
              {statusBanner.message}
            </AlertDescription>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-xs font-semibold hover:underline shrink-0 ml-2"
          >
            Tutup
          </button>
        </Alert>
      )}

      {/* 3. Toolbar: Filter Mata Kuliah */}
      {activeSemester && !isLoading && schedules.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border rounded-lg p-3">
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <label htmlFor="course-filter" className="text-xs font-medium text-muted-foreground shrink-0">
              Filter Kuliah:
            </label>
            <Select
              value={selectedCourseFilter}
              onValueChange={(val) => setSelectedCourseFilter(val)}
            >
              <SelectTrigger id="course-filter" aria-label="Filter Mata Kuliah" className="h-9 text-xs">
                <SelectValue placeholder="Semua Mata Kuliah" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  Semua Mata Kuliah ({schedules.length} Sesi)
                </SelectItem>
                {courses.map((crs) => {
                  const count = schedules.filter((s) => s.courseId === crs.id).length;
                  return (
                    <SelectItem key={crs.id} value={crs.id} className="text-xs">
                      {crs.name} ({count} sesi)
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {selectedCourseFilter !== 'all' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedCourseFilter('all')}
              className="h-8 text-xs text-muted-foreground hover:text-foreground self-start sm:self-auto"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              <span>Reset Filter</span>
            </Button>
          )}
        </div>
      )}

      {/* 4. State Tampilan Konten */}

      {/* A. Loading State */}
      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div key={idx} className="space-y-2 border border-border rounded-lg p-3 bg-card">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* B. Error State */}
      {!isLoading && errorMsg && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Gagal Memuat Jadwal</AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
            <span>{errorMsg}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchScheduleData(activeSemester)}
              className="w-fit"
            >
              Coba Lagi
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* C. Empty State: Belum Ada Semester Aktif */}
      {!isLoading && !errorMsg && !activeSemester && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center bg-muted/10 space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CalendarRange className="h-6 w-6" />
          </div>
          <h2 className="text-base font-semibold text-foreground">
            Belum Ada Semester Aktif
          </h2>
          <p className="mx-auto max-w-md text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Jadwal perkuliahan diorganisir per semester akademik. Silakan aktifkan atau buat semester baru terlebih dahulu.
          </p>
          <div className="pt-2">
            <Button asChild size="standard" variant="default">
              <Link href="/semesters">Buka Kelola Semester</Link>
            </Button>
          </div>
        </div>
      )}

      {/* D. Empty State: Semester Aktif Belum Punya Jadwal (Onboarding) */}
      {!isLoading && !errorMsg && activeSemester && schedules.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center bg-muted/10 space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CalendarClock className="h-6 w-6" />
          </div>
          <h2 className="text-base font-semibold text-foreground">
            Belum Ada Jadwal Kuliah
          </h2>
          <p className="mx-auto max-w-md text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {courses.length === 0
              ? 'Semester ini belum memiliki mata kuliah aktif. Tambahkan mata kuliah terlebih dahulu sebelum mengatur jadwal sesi.'
              : 'Susun agenda mingguan Anda agar waktu belajar, tenggat tugas, dan ruang kelas tertata rapi.'}
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-2">
            {courses.length === 0 ? (
              <Button asChild size="standard" variant="default">
                <Link href="/courses">Tambah Mata Kuliah</Link>
              </Button>
            ) : (
              <Button
                size="standard"
                variant="default"
                onClick={() => setIsCreateOpen(true)}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                <span>Tambah Jadwal Pertama</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* E. Empty State: Filter Tidak Menemukan Jadwal */}
      {!isLoading && !errorMsg && activeSemester && schedules.length > 0 && filteredSchedules.length === 0 && (
        <div className="rounded-xl border border-border p-8 text-center bg-card space-y-3">
          <p className="text-sm font-medium text-foreground">
            Tidak ada sesi jadwal untuk mata kuliah yang dipilih.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedCourseFilter('all')}
            className="text-xs"
          >
            Tampilkan Semua Jadwal
          </Button>
        </div>
      )}

      {/* F. TAMPILAN JADWAL TERISI */}
      {!isLoading && !errorMsg && activeSemester && filteredSchedules.length > 0 && (
        <div>
          {/* F.1 TAMPILAN DESKTOP (Grid Mingguan Senin–Minggu) */}
          <div className="hidden lg:grid grid-cols-7 gap-3 items-start">
            {[1, 2, 3, 4, 5, 6, 7].map((dayNum) => {
              const dayItems = schedulesByDay[dayNum] || [];
              const isWeekend = dayNum === 6 || dayNum === 7;
              const isCurrentDay = getCurrentDayOfWeekInTimezone(timezone) === dayNum;

              return (
                <div
                  key={dayNum}
                  className={`rounded-xl border ${
                    isCurrentDay
                      ? 'border-primary/50 bg-primary/[0.02] shadow-xs'
                      : 'border-border bg-card'
                  } flex flex-col min-h-[380px]`}
                >
                  {/* Day Column Header */}
                  <div
                    className={`p-3 border-b border-border flex items-center justify-between ${
                      isCurrentDay ? 'bg-primary/10 text-primary' : 'bg-muted/30 text-foreground'
                    } rounded-t-xl`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-sm tracking-tight truncate">
                        {getDayNameId(dayNum)}
                      </span>
                      {isCurrentDay && (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4">
                          Hari Ini
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {dayItems.length}
                    </span>
                  </div>

                  {/* Day Column Items */}
                  <div className="p-2.5 space-y-2.5 flex-1">
                    {dayItems.length === 0 ? (
                      <div className="h-32 flex items-center justify-center text-center p-2 text-xs text-muted-foreground/60">
                        {isWeekend ? 'Tidak ada kelas' : 'Kosong'}
                      </div>
                    ) : (
                      dayItems.map((item) => (
                        <ScheduleCard
                          key={item.id}
                          schedule={item}
                          onEdit={() => setEditingSchedule(item)}
                          onDelete={() => setDeletingSchedule(item)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* F.2 TAMPILAN MOBILE (< 1024px: Agenda Harian Responsif) */}
          <div className="lg:hidden space-y-4">
            {/* Horizontal Day Selector (Touch Target >= 44x44px) */}
            <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none">
              {[1, 2, 3, 4, 5, 6, 7].map((dayNum) => {
                const count = schedulesByDay[dayNum]?.length || 0;
                const isSelected = mobileSelectedDay === dayNum;
                const isToday = getCurrentDayOfWeekInTimezone(timezone) === dayNum;

                return (
                  <button
                    key={dayNum}
                    type="button"
                    onClick={() => setMobileSelectedDay(dayNum)}
                    className={`flex-1 min-w-[56px] min-h-[44px] px-2 py-1.5 rounded-lg border text-center transition-colors flex flex-col items-center justify-center gap-0.5 touch-manipulation ${
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground font-semibold shadow-xs'
                        : 'border-border bg-card text-foreground hover:bg-muted'
                    }`}
                    aria-label={`Pilih hari ${getDayNameId(dayNum)}, ${count} sesi jadwal`}
                  >
                    <span className="text-xs truncate">{getDayNameId(dayNum).substring(0, 3)}</span>
                    <span
                      className={`text-[10px] px-1 rounded-full ${
                        isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {count}
                    </span>
                    {isToday && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-0.5" title="Hari ini" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected Day Agenda Header */}
            <div className="flex items-center justify-between px-1">
              <h2 className="text-base font-bold text-foreground">
                Jadwal Hari {getDayNameId(mobileSelectedDay)}
              </h2>
              <span className="text-xs text-muted-foreground">
                {schedulesByDay[mobileSelectedDay]?.length || 0} Sesi Perkuliahan
              </span>
            </div>

            {/* List Sesi Hari Terpilih */}
            <div className="space-y-3">
              {(schedulesByDay[mobileSelectedDay] || []).length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center bg-muted/10 space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Tidak ada jadwal kuliah pada hari {getDayNameId(mobileSelectedDay)}.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Gunakan waktu luang untuk mempelajari materi atau mengerjakan tugas.
                  </p>
                </div>
              ) : (
                schedulesByDay[mobileSelectedDay].map((item) => (
                  <ScheduleCard
                    key={item.id}
                    schedule={item}
                    isMobileView
                    onEdit={() => setEditingSchedule(item)}
                    onDelete={() => setDeletingSchedule(item)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Dialogs */}
      <CreateScheduleDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        courses={courses}
        onSuccess={handleCreateSuccess}
      />

      <EditScheduleDialog
        open={Boolean(editingSchedule)}
        onOpenChange={(open) => !open && setEditingSchedule(null)}
        schedule={editingSchedule}
        onSuccess={handleEditSuccess}
      />

      <DeleteScheduleDialog
        open={Boolean(deletingSchedule)}
        onOpenChange={(open) => !open && setDeletingSchedule(null)}
        schedule={deletingSchedule}
        onSuccess={handleDeleteSuccess}
      />
    </div>
  );
}

// Subkomponen Kartu Jadwal
interface ScheduleCardProps {
  schedule: CourseSchedule;
  isMobileView?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function ScheduleCard({
  schedule,
  isMobileView,
  onEdit,
  onDelete,
}: ScheduleCardProps): React.JSX.Element {
  const hasConflict = schedule.hasConflict;
  const course = schedule.course;

  return (
    <div
      className={`rounded-lg border ${
        hasConflict
          ? 'border-destructive/60 bg-destructive/[0.04]'
          : 'border-border/80 bg-background/80 hover:border-border'
      } p-3 transition-colors space-y-2 relative group shadow-2xs`}
    >
      {/* Top: Waktu & Aksi Dropdown */}
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-foreground">
          <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
          <span>
            {schedule.startTime} – {schedule.endTime}
          </span>
        </div>

        {/* Dropdown Menu Tiga Titik */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground relative after:absolute after:-inset-2 sm:after:hidden touch-manipulation"
              aria-label={`Menu aksi jadwal ${course?.name || ''}`}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={onEdit} className="text-xs gap-2 cursor-pointer">
              <Pencil className="h-3.5 w-3.5" />
              <span>Edit Sesi</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="text-xs gap-2 text-destructive focus:text-destructive cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Hapus Sesi</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Info Mata Kuliah */}
      <div className="space-y-0.5">
        <Link
          href={`/courses/${schedule.courseId}`}
          className="text-xs sm:text-sm font-semibold text-foreground hover:text-primary transition-colors line-clamp-2 block"
        >
          {course?.name || 'Mata Kuliah'}
        </Link>
        {course?.code && (
          <p className="font-mono text-[11px] text-muted-foreground truncate">
            {course.code}
          </p>
        )}
      </div>

      {/* Dosen & Ruangan */}
      <div className="space-y-1 pt-1 border-t border-border/50 text-[11px] text-muted-foreground">
        {course?.lecturer && (
          <div className="flex items-center gap-1.5 truncate">
            <User className="h-3 w-3 shrink-0 text-muted-foreground/70" />
            <span className="truncate">{course.lecturer}</span>
          </div>
        )}

        {schedule.room && (
          <div className="flex items-center gap-1.5 truncate font-medium text-foreground/90">
            <MapPin className="h-3 w-3 shrink-0 text-primary" />
            <span className="truncate">{schedule.room}</span>
          </div>
        )}
      </div>

      {/* Peringatan Benturan Waktu (Accessible Text & Icon) */}
      {hasConflict && (
        <div className="pt-1.5">
          <div className="rounded-md bg-destructive/10 border border-destructive/30 p-2 text-[11px] text-destructive space-y-1">
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>Benturan Waktu</span>
            </div>
            {schedule.conflicts && schedule.conflicts.length > 0 && (
              <p className="text-[10px] text-destructive/90 leading-tight">
                Tabrakan dengan:{' '}
                {schedule.conflicts.map((c) => c.courseName).join(', ')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
