'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  Clock,
  MapPin,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  CircleDot,
  CalendarCheck2,
} from 'lucide-react';
import {
  CourseSchedule,
  CourseScheduleConflict,
  getDayNameId,
} from '@studyflow/shared';
import { listSchedules } from '@/lib/schedule-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export interface TodayScheduleWidgetProps {
  activeSemesterId?: string | null;
  activeSemesterName?: string | null;
  timezone: string;
}

export type ScheduleTimeStatus = 'UPCOMING' | 'ONGOING' | 'COMPLETED';

/**
 * Menghitung hari, jam-menit, dan tanggal saat ini berdasarkan zona waktu pengguna.
 */
export function getNowInTimezone(timezone: string): {
  dayOfWeek: number;
  currentTime: string;
  dateKey: string;
} {
  try {
    const now = new Date();
    const weekdayStr = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
    }).format(now);

    const dayMap: Record<string, number> = {
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
      Sun: 7,
    };
    const dayOfWeek = dayMap[weekdayStr] || 1;

    const timeFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const currentTime = timeFormatter.format(now);

    const dateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const dateKey = dateFormatter.format(now);

    return { dayOfWeek, currentTime, dateKey };
  } catch {
    const now = new Date();
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;
    const dateKey = now.toISOString().slice(0, 10);
    return { dayOfWeek, currentTime, dateKey };
  }
}

/**
 * Menentukan status waktu sesi lokal:
 * - UPCOMING: waktu sekarang sebelum mulai (now < startTime)
 * - ONGOING: mulai <= sekarang < selesai (startTime <= now < endTime)
 * - COMPLETED: sekarang >= selesai (now >= endTime)
 */
export function getScheduleTimeStatus(
  startTime: string,
  endTime: string,
  currentTime: string
): ScheduleTimeStatus {
  if (currentTime < startTime) {
    return 'UPCOMING';
  }
  if (currentTime >= endTime) {
    return 'COMPLETED';
  }
  return 'ONGOING';
}

export function TodayScheduleWidget({
  activeSemesterId,
  activeSemesterName,
  timezone,
}: TodayScheduleWidgetProps): React.JSX.Element {
  const [schedules, setSchedules] = React.useState<CourseSchedule[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Time tracking states
  const [isMounted, setIsMounted] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState('00:00');
  const [currentDayOfWeek, setCurrentDayOfWeek] = React.useState(1);
  const [currentDateKey, setCurrentDateKey] = React.useState('');

  // Race condition guard for semester fetches
  const fetchRequestIdRef = React.useRef(0);

  // 1. Fetch jadwal hari ini untuk semester aktif
  const fetchTodaySchedules = React.useCallback(
    async (semId?: string | null, targetDay?: number) => {
      if (!semId) {
        setSchedules([]);
        setIsLoading(false);
        setErrorMsg(null);
        return;
      }

      const reqId = ++fetchRequestIdRef.current;
      setIsLoading(true);
      setErrorMsg(null);

      try {
        const day = targetDay ?? getNowInTimezone(timezone).dayOfWeek;
        const res = await listSchedules({ semesterId: semId, dayOfWeek: day });

        // Abaikan respons terlambat dari semester sebelumnya
        if (reqId === fetchRequestIdRef.current) {
          // Urutkan berdasarkan waktu mulai (asc)
          const sorted = [...res.schedules].sort((a, b) =>
            a.startTime.localeCompare(b.startTime)
          );
          setSchedules(sorted);
        }
      } catch (err: any) {
        if (reqId === fetchRequestIdRef.current) {
          setErrorMsg(err.message || 'Gagal memuat jadwal hari ini.');
        }
      } finally {
        if (reqId === fetchRequestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [timezone]
  );

  // 2. Sinkronisasi waktu dan muat jadwal saat semester aktif atau timezone berubah
  React.useEffect(() => {
    setIsMounted(true);
    const nowInfo = getNowInTimezone(timezone);
    setCurrentTime(nowInfo.currentTime);
    setCurrentDayOfWeek(nowInfo.dayOfWeek);
    setCurrentDateKey(nowInfo.dateKey);

    if (activeSemesterId) {
      fetchTodaySchedules(activeSemesterId, nowInfo.dayOfWeek);
    } else {
      setSchedules([]);
      setIsLoading(false);
    }
  }, [timezone, activeSemesterId, fetchTodaySchedules]);

  // 2b. Listener langsung terhadap event pergantian semester global
  React.useEffect(() => {
    const handleSemesterChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ semesterId?: string }>;
      const newSemId = customEvent.detail?.semesterId;
      if (newSemId) {
        const nowInfo = getNowInTimezone(timezone);
        fetchTodaySchedules(newSemId, nowInfo.dayOfWeek);
      }
    };
    window.addEventListener('studyflow:semester-changed', handleSemesterChange);
    return () => {
      window.removeEventListener('studyflow:semester-changed', handleSemesterChange);
    };
  }, [timezone, fetchTodaySchedules]);

  // 4. Timer lokal 1 menit & Listener pergantian hari / visibility change
  React.useEffect(() => {
    if (!isMounted) return;

    const checkTimeAndDate = () => {
      const nowInfo = getNowInTimezone(timezone);
      setCurrentTime(nowInfo.currentTime);

      // Jika tanggal/hari berganti menurut zona waktu pengguna, perbarui daftar hari ini
      if (nowInfo.dateKey !== currentDateKey || nowInfo.dayOfWeek !== currentDayOfWeek) {
        setCurrentDateKey(nowInfo.dateKey);
        setCurrentDayOfWeek(nowInfo.dayOfWeek);
        if (activeSemesterId) {
          fetchTodaySchedules(activeSemesterId, nowInfo.dayOfWeek);
        }
      }
    };

    // Jalankan timer per menit tanpa request API per menit
    const intervalId = window.setInterval(checkTimeAndDate, 60000);

    // Saat tab browser kembali aktif, sinkronkan waktu lokal
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkTimeAndDate();
      }
    };
    const handleWindowFocus = () => {
      checkTimeAndDate();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [
    isMounted,
    timezone,
    currentDateKey,
    currentDayOfWeek,
    activeSemesterId,
    fetchTodaySchedules,
  ]);

  const dayName = isMounted ? getDayNameId(currentDayOfWeek) : 'Hari Ini';

  return (
    <div
      className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs flex flex-col justify-between"
      data-testid="today-schedule-widget"
    >
      <div>
        {/* Header Widget */}
        <div className="flex items-center justify-between pb-3.5 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <CalendarClock className="h-4 w-4 text-primary shrink-0" />
            <h2 className="text-base font-semibold text-foreground truncate">
              Jadwal Hari Ini
            </h2>
            {isMounted && !isLoading && schedules.length > 0 && (
              <Badge variant="secondary" className="text-xs shrink-0 font-medium ml-0.5">
                {schedules.length}
              </Badge>
            )}
          </div>
          <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs shrink-0">
            <Link href="/schedule" className="gap-1">
              <span>Lihat jadwal</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {/* Content Section */}
        <div className="mt-3">
          {/* A. Loading State */}
          {isLoading && (
            <div className="space-y-3">
              {[1, 2].map((idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-border/70 p-3 bg-muted/20 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-5 w-20 rounded-md" />
                  </div>
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
          )}

          {/* B. Error State Terisolasi */}
          {!isLoading && errorMsg && (
            <Alert variant="destructive" className="py-3">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="text-xs font-semibold">Gagal Memuat Jadwal</AlertTitle>
              <AlertDescription className="text-xs mt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span>{errorMsg}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchTodaySchedules(activeSemesterId, currentDayOfWeek)}
                  className="h-7 px-2 text-xs w-fit"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  <span>Coba lagi</span>
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* C. Belum Ada Semester Aktif */}
          {!isLoading && !errorMsg && !activeSemesterId && (
            <div className="flex flex-col items-center justify-center py-5 text-center text-muted-foreground">
              <CalendarClock className="h-6 w-6 text-muted-foreground/60 mb-2" />
              <p className="text-sm font-medium text-foreground">
                Belum ada semester aktif
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">
                Aktifkan semester akademik untuk menampilkan jadwal kuliah hari ini.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-3 text-xs h-8">
                <Link href="/semesters">Pilih Semester</Link>
              </Button>
            </div>
          )}

          {/* D. Empty State: Tidak Ada Kelas Hari Ini */}
          {!isLoading && !errorMsg && activeSemesterId && schedules.length === 0 && (
            <div className="flex flex-col items-center justify-center py-5 text-center text-muted-foreground">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
                <CalendarCheck2 className="h-4.5 w-4.5" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Tidak ada kelas hari ini ({dayName})
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-xs leading-relaxed">
                Gunakan waktu luang untuk mempelajari materi atau menyelesaikan tugas kuliah.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-3 text-xs h-8">
                <Link href="/schedule">Buka Jadwal Lengkap</Link>
              </Button>
            </div>
          )}

          {/* E. List Sesi Jadwal Hari Ini */}
          {!isLoading && !errorMsg && activeSemesterId && schedules.length > 0 && (
            <div className="space-y-2.5">
              {schedules.map((sched) => {
                const status = isMounted
                  ? getScheduleTimeStatus(sched.startTime, sched.endTime, currentTime)
                  : 'UPCOMING';
                const hasConflict = sched.hasConflict;

                return (
                  <div
                    key={sched.id}
                    className={`rounded-lg border p-3 transition-colors space-y-1.5 ${
                      status === 'ONGOING'
                        ? 'border-primary/60 bg-primary/5 shadow-2xs'
                        : hasConflict
                        ? 'border-destructive/40 bg-destructive/[0.03]'
                        : 'border-border/80 bg-muted/15 hover:bg-muted/30'
                    }`}
                  >
                    {/* Waktu & Status Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-foreground">
                        <Clock
                          className={`h-3.5 w-3.5 shrink-0 ${
                            status === 'ONGOING' ? 'text-primary' : 'text-muted-foreground'
                          }`}
                        />
                        <span>
                          {sched.startTime} – {sched.endTime}
                        </span>
                      </div>

                      {/* Status Waktu dengan teks & ikon semantik */}
                      {status === 'ONGOING' ? (
                        <Badge
                          variant="default"
                          className="text-[11px] py-0 px-2 gap-1 font-semibold bg-primary text-primary-foreground"
                        >
                          <CircleDot className="h-3 w-3 animate-pulse" />
                          <span>Berlangsung</span>
                        </Badge>
                      ) : status === 'COMPLETED' ? (
                        <Badge
                          variant="secondary"
                          className="text-[11px] py-0 px-2 gap-1 font-normal text-muted-foreground bg-muted"
                        >
                          <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
                          <span>Selesai</span>
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[11px] py-0 px-2 gap-1 font-normal text-muted-foreground border-border"
                        >
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span>Akan datang</span>
                        </Badge>
                      )}
                    </div>

                    {/* Nama Mata Kuliah (Bisa diklik untuk melihat detail) */}
                    <div>
                      <Link
                        href={`/courses/${sched.courseId}`}
                        className={`text-xs sm:text-sm font-semibold transition-colors block truncate ${
                          status === 'COMPLETED'
                            ? 'text-muted-foreground hover:text-foreground'
                            : 'text-foreground hover:text-primary'
                        }`}
                        title={sched.course?.name || 'Mata Kuliah'}
                      >
                        {sched.course?.name || 'Mata Kuliah'}
                      </Link>
                      {sched.course?.code && (
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {sched.course.code}
                        </span>
                      )}
                    </div>

                    {/* Ruangan */}
                    {sched.room ? (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-0.5">
                        <MapPin className="h-3 w-3 shrink-0 text-primary" />
                        <span className="truncate font-medium text-foreground/80">
                          {sched.room}
                        </span>
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground italic pt-0.5">
                        Ruangan belum ditentukan
                      </p>
                    )}

                    {/* Benturan Waktu jika terdeteksi */}
                    {hasConflict && sched.conflicts && sched.conflicts.length > 0 && (
                      <div className="rounded border border-destructive/30 bg-destructive/10 p-1.5 text-[11px] text-destructive flex items-start gap-1.5 mt-1">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span className="leading-tight">
                          Benturan dengan: {sched.conflicts.map((c) => c.courseName).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
