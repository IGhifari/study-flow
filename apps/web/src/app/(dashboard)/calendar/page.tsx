'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  CalendarDays,
  CalendarClock,
  ListTodo,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Globe,
  Filter,
  Info,
  AlertCircle,
  Plus,
} from 'lucide-react';
import {
  Semester,
  Course,
  UserProfile,
  CalendarEvent,
  CalendarFilterType,
} from '@studyflow/shared';
import { listSemesters } from '@/lib/semester-client';
import { listCourses } from '@/lib/course-client';
import { getProfile } from '@/lib/auth-client';
import { getCalendarData } from '@/lib/calendar-client';
import {
  getTodayDateString,
  getMonthGridRange,
  getWeekRange,
  formatMonthHeader,
  formatWeekHeader,
  parseDateString,
  formatTimezoneBadge,
} from '@/lib/calendar-utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  RadixSelect as Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MonthView } from '@/components/calendar/month-view';
import { WeekView } from '@/components/calendar/week-view';
import { AgendaView } from '@/components/calendar/agenda-view';
import { EventDetailDialog } from '@/components/calendar/event-detail-dialog';
import { DayEventsDialog } from '@/components/calendar/day-events-dialog';

type CalendarViewMode = 'month' | 'week' | 'agenda';

export default function CalendarPage(): React.JSX.Element {
  const searchParams = useSearchParams();
  const querySemesterId = searchParams.get('semesterId');
  const queryCourseId = searchParams.get('courseId');

  // User Profile & Timezone
  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
  const timezone = userProfile?.timezone || 'Asia/Jakarta';

  // Semester & Courses
  const [semesters, setSemesters] = React.useState<Semester[]>([]);
  const [activeSemester, setActiveSemester] = React.useState<Semester | null>(null);
  const [courses, setCourses] = React.useState<Course[]>([]);

  // Filters
  const [selectedCourseFilter, setSelectedCourseFilter] = React.useState<string>(
    queryCourseId || 'all'
  );
  const [selectedTypeFilter, setSelectedTypeFilter] = React.useState<CalendarFilterType>('all');

  // View Mode: Desktop default 'month', Mobile default 'agenda'
  const [viewMode, setViewMode] = React.useState<CalendarViewMode>('month');

  // Anchor Date State
  const [currentYear, setCurrentYear] = React.useState<number>(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = React.useState<number>(() => new Date().getMonth() + 1); // 1-12
  const [currentDateStr, setCurrentDateStr] = React.useState<string>(() =>
    getTodayDateString('Asia/Jakarta')
  );

  // Events & Loading State
  const [events, setEvents] = React.useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Modal dialog states
  const [selectedEvent, setSelectedEvent] = React.useState<CalendarEvent | null>(null);
  const [dayEventsDate, setDayEventsDate] = React.useState<string | null>(null);
  const [dayEventsList, setDayEventsList] = React.useState<CalendarEvent[]>([]);

  // Request race-condition guard
  const fetchRequestIdRef = React.useRef(0);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // 1. Deteksi viewport mobile saat pertama kali render untuk mengatur default view
  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setViewMode('agenda');
    }
  }, []);

  // 2. Load User Profile & Timezone
  React.useEffect(() => {
    let isMounted = true;
    getProfile()
      .then((profile) => {
        if (!isMounted || !profile) return;
        setUserProfile(profile);
        const todayTz = getTodayDateString(profile.timezone || 'Asia/Jakarta');
        const parsed = parseDateString(todayTz);
        setCurrentDateStr(todayTz);
        setCurrentYear(parsed.year);
        setCurrentMonth(parsed.month);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  // 3. Load Semesters & Sync Active Semester
  React.useEffect(() => {
    let isMounted = true;
    async function loadSemesters() {
      try {
        const res = await listSemesters('all');
        if (!isMounted) return;
        setSemesters(res.semesters);
        const matched = querySemesterId
          ? res.semesters.find((s) => s.id === querySemesterId) || res.activeSemester
          : res.activeSemester;
        setActiveSemester(matched);
      } catch (err: any) {
        if (!isMounted) return;
        setErrorMessage(err.message || 'Gagal memuat semester');
      }
    }

    loadSemesters();

    const handleSemesterChange = () => {
      listSemesters('all')
        .then((res) => {
          if (!isMounted) return;
          setSemesters(res.semesters);
          setActiveSemester(res.activeSemester);
        })
        .catch(console.error);
    };

    window.addEventListener('studyflow:semester-changed', handleSemesterChange);
    return () => {
      isMounted = false;
      window.removeEventListener('studyflow:semester-changed', handleSemesterChange);
    };
  }, [querySemesterId]);

  // 4. Load Courses when activeSemester changes
  React.useEffect(() => {
    let isMounted = true;
    if (!activeSemester) {
      setCourses([]);
      return;
    }

    listCourses({ semesterId: activeSemester.id })
      .then((res) => {
        if (!isMounted) return;
        // Hanya tampilkan mata kuliah yang tidak diarsipkan
        setCourses(res.courses.filter((c) => !c.archivedAt));
      })
      .catch((err) => {
        console.error('Failed to load courses for calendar:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [activeSemester]);

  // 5. Hitung Rentang Tanggal berdasarkan View Mode aktif
  const currentRange = React.useMemo(() => {
    if (viewMode === 'month' || viewMode === 'agenda') {
      return getMonthGridRange(currentYear, currentMonth);
    } else {
      return getWeekRange(currentDateStr);
    }
  }, [viewMode, currentYear, currentMonth, currentDateStr]);

  // 6. Fetch Kalender Data dengan AbortController & Sequence Guard
  const fetchCalendar = React.useCallback(
    async (targetSemester: Semester | null) => {
      if (!targetSemester) {
        setEvents([]);
        setIsLoading(false);
        return;
      }

      // Batalkan request yang sedang berjalan sebelumnya
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const requestId = ++fetchRequestIdRef.current;
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const data = await getCalendarData(
          {
            semesterId: targetSemester.id,
            courseId: selectedCourseFilter !== 'all' ? selectedCourseFilter : undefined,
            type: selectedTypeFilter,
            startDate: currentRange.startDate,
            endDate: currentRange.endDate,
          },
          controller.signal
        );

        if (requestId === fetchRequestIdRef.current) {
          setEvents(data.events);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        if (requestId === fetchRequestIdRef.current) {
          setErrorMessage(err.message || 'Gagal memuat agenda kalender');
        }
      } finally {
        if (requestId === fetchRequestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [currentRange, selectedCourseFilter, selectedTypeFilter]
  );

  React.useEffect(() => {
    fetchCalendar(activeSemester);
  }, [fetchCalendar, activeSemester]);

  // 7. Navigasi Periode (Sebelumnya, Berikutnya, Hari Ini)
  const handlePreviousPeriod = () => {
    if (viewMode === 'month' || viewMode === 'agenda') {
      if (currentMonth === 1) {
        setCurrentMonth(12);
        setCurrentYear((prev) => prev - 1);
      } else {
        setCurrentMonth((prev) => prev - 1);
      }
    } else {
      // Minggu sebelumnya (-7 hari)
      const { year, month, day } = parseDateString(currentDateStr);
      const d = new Date(Date.UTC(year, month - 1, day - 7));
      const newDateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      setCurrentDateStr(newDateStr);
      setCurrentYear(d.getUTCFullYear());
      setCurrentMonth(d.getUTCMonth() + 1);
    }
  };

  const handleNextPeriod = () => {
    if (viewMode === 'month' || viewMode === 'agenda') {
      if (currentMonth === 12) {
        setCurrentMonth(1);
        setCurrentYear((prev) => prev + 1);
      } else {
        setCurrentMonth((prev) => prev + 1);
      }
    } else {
      // Minggu berikutnya (+7 hari)
      const { year, month, day } = parseDateString(currentDateStr);
      const d = new Date(Date.UTC(year, month - 1, day + 7));
      const newDateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      setCurrentDateStr(newDateStr);
      setCurrentYear(d.getUTCFullYear());
      setCurrentMonth(d.getUTCMonth() + 1);
    }
  };

  const handleTodayPeriod = () => {
    const todayTz = getTodayDateString(timezone);
    const parsed = parseDateString(todayTz);
    setCurrentDateStr(todayTz);
    setCurrentYear(parsed.year);
    setCurrentMonth(parsed.month);
  };

  const todayDateStr = React.useMemo(() => getTodayDateString(timezone), [timezone]);

  // Label Header Periode
  const periodTitle = React.useMemo(() => {
    if (viewMode === 'month' || viewMode === 'agenda') {
      return formatMonthHeader(currentYear, currentMonth);
    } else {
      const days = currentRange.days;
      return formatWeekHeader(days[0]!, days[days.length - 1]!);
    }
  }, [viewMode, currentYear, currentMonth, currentRange]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Header Halaman */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Kalender
            </h1>
            <Badge variant="outline" className="text-xs gap-1.5 font-medium bg-muted/50">
              <Globe className="h-3 w-3 text-primary" />
              {formatTimezoneBadge(timezone)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Jadwal perkuliahan mingguan dan batas waktu tugas kuliah dalam satu tampilan terpadu.
          </p>
        </div>

        {/* Action button link ke penambahan jadwal / tugas */}
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href="/schedule">
              <CalendarClock className="h-4 w-4 text-primary" />
              <span className="hidden sm:inline">Kelola</span> Jadwal
            </Link>
          </Button>
          <Button asChild size="sm" className="gap-1.5">
            <Link href="/assignments">
              <ListTodo className="h-4 w-4" />
              <span className="hidden sm:inline">Kelola</span> Tugas
            </Link>
          </Button>
        </div>
      </div>

      {/* 2. Disclaimer Penjelasan Jadwal Berulang */}
      <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-2.5 text-xs text-muted-foreground">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <span>
          Jadwal kuliah ditampilkan sebagai pola mingguan berulang pada semester terpilih. Hari libur nasional dan penyesuaian pertemuan tatap muka belum diperhitungkan.
        </span>
      </div>

      {/* 3. Toolbar Kontrol, Filter, dan Navigasi Periode */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-xl border bg-card shadow-xs">
        {/* Kiri: Navigasi Periode (< > Hari Ini) & Label Bulan/Minggu */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center border rounded-lg bg-background p-0.5 shadow-2xs">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePreviousPeriod}
              title="Periode sebelumnya"
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleTodayPeriod}
              className="h-8 px-2.5 text-xs font-semibold"
            >
              Hari ini
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextPeriod}
              title="Periode berikutnya"
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <h2 className="text-base sm:text-lg font-bold text-foreground min-w-[140px]">
            {periodTitle}
          </h2>
        </div>

        {/* Kanan: Filter Semester, Mata Kuliah, Tipe, & View Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Semester Selector */}
          <div className="w-[170px] sm:w-[190px]">
            <Select
              value={activeSemester?.id}
              onValueChange={(val) => {
                const found = semesters.find((s) => s.id === val);
                if (found) setActiveSemester(found);
              }}
              disabled={semesters.length === 0}
            >
              <SelectTrigger aria-label="Pilih Semester" className="h-9 text-xs font-medium">
                <SelectValue placeholder="Pilih Semester" />
              </SelectTrigger>
              <SelectContent>
                {semesters.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {s.name} {s.isActive ? '(Aktif)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Course Filter */}
          <div className="w-[160px] sm:w-[180px]">
            <Select
              value={selectedCourseFilter}
              onValueChange={(val) => setSelectedCourseFilter(val)}
            >
              <SelectTrigger aria-label="Filter Mata Kuliah" className="h-9 text-xs font-medium">
                <SelectValue placeholder="Semua Mata Kuliah" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  Semua Mata Kuliah
                </SelectItem>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type Filter */}
          <div className="w-[120px]">
            <Select
              value={selectedTypeFilter}
              onValueChange={(val) => setSelectedTypeFilter(val as CalendarFilterType)}
            >
              <SelectTrigger aria-label="Filter Tipe Acara" className="h-9 text-xs font-medium">
                <SelectValue placeholder="Semua Tipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  Semua Tipe
                </SelectItem>
                <SelectItem value="schedule" className="text-xs">
                  Kuliah Saja
                </SelectItem>
                <SelectItem value="assignment" className="text-xs">
                  Tugas Saja
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* View Mode Toggle (Tabs) */}
          <Tabs
            value={viewMode}
            onValueChange={(val) => setViewMode(val as CalendarViewMode)}
            className="hidden sm:inline-flex"
          >
            <TabsList className="h-9 p-0.5">
              <TabsTrigger value="month" className="text-xs px-2.5 h-8">
                Bulan
              </TabsTrigger>
              <TabsTrigger value="week" className="text-xs px-2.5 h-8">
                Minggu
              </TabsTrigger>
              <TabsTrigger value="agenda" className="text-xs px-2.5 h-8">
                Agenda
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* 4. Error Banner */}
      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Terjadi Kesalahan</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{errorMessage}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchCalendar(activeSemester)}
              className="h-7 text-xs gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Coba Lagi
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* 5. Konten Kalender Berdasarkan View Mode */}
      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded" />
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 28 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded" />
            ))}
          </div>
        </div>
      ) : !activeSemester ? (
        <div className="border rounded-xl p-8 bg-card text-center space-y-3">
          <h3 className="font-bold text-base text-foreground">Belum Ada Semester</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Anda belum memiliki semester. Silakan buat semester terlebih dahulu di halaman Kelola Semester.
          </p>
          <Button asChild size="sm">
            <Link href="/semesters">Kelola Semester</Link>
          </Button>
        </div>
      ) : (
        <>
          {viewMode === 'month' && (
            <div className="hidden sm:block">
              <MonthView
                days={currentRange.days}
                activeMonth={currentMonth}
                activeYear={currentYear}
                todayDateStr={todayDateStr}
                events={events}
                onSelectEvent={(ev) => setSelectedEvent(ev)}
                onOpenDayEvents={(date, list) => {
                  setDayEventsDate(date);
                  setDayEventsList(list);
                }}
              />
            </div>
          )}

          {viewMode === 'week' && (
            <div className="hidden sm:block">
              <WeekView
                days={currentRange.days}
                todayDateStr={todayDateStr}
                events={events}
                onSelectEvent={(ev) => setSelectedEvent(ev)}
              />
            </div>
          )}

          {/* Agenda view: selalu tampil pada mobile atau saat mode agenda aktif */}
          <div className={viewMode === 'agenda' ? 'block' : 'sm:hidden'}>
            <AgendaView
              events={events}
              todayDateStr={todayDateStr}
              onSelectEvent={(ev) => setSelectedEvent(ev)}
              hasSemester={Boolean(activeSemester)}
              hasCourses={courses.length > 0}
            />
          </div>
        </>
      )}

      {/* 6. Modals */}
      <EventDetailDialog
        event={selectedEvent}
        isOpen={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(null)}
        timezone={timezone}
      />

      <DayEventsDialog
        dateStr={dayEventsDate}
        events={dayEventsList}
        isOpen={Boolean(dayEventsDate)}
        onClose={() => setDayEventsDate(null)}
        onSelectEvent={(ev) => setSelectedEvent(ev)}
      />
    </div>
  );
}
