'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  ListTodo,
  Clock,
  MapPin,
  User,
  AlertCircle,
  CheckCircle2,
  CalendarDays,
  Plus,
} from 'lucide-react';
import { CalendarEvent } from '@studyflow/shared';
import {
  formatAgendaDateHeader,
  groupEventsByDate,
} from '@/lib/calendar-utils';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface AgendaViewProps {
  events: CalendarEvent[];
  todayDateStr: string;
  onSelectEvent: (event: CalendarEvent) => void;
  hasSemester: boolean;
  hasCourses: boolean;
}

export function AgendaView({
  events,
  todayDateStr,
  onSelectEvent,
  hasSemester,
  hasCourses,
}: AgendaViewProps): React.JSX.Element {
  const groupedEvents = React.useMemo(() => groupEventsByDate(events), [events]);
  const sortedDates = React.useMemo(() => Object.keys(groupedEvents).sort(), [groupedEvents]);

  if (sortedDates.length === 0) {
    return (
      <div className="w-full border rounded-xl p-8 bg-card text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
          <CalendarDays className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h3 className="font-bold text-base text-foreground">
            Tidak Ada Agenda pada Periode Ini
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {!hasSemester
              ? 'Anda belum memiliki semester aktif. Buat atau aktifkan semester terlebih dahulu.'
              : !hasCourses
              ? 'Anda belum memiliki mata kuliah pada semester ini. Tambahkan mata kuliah untuk mulai mengatur jadwal dan tugas.'
              : 'Tidak ada jadwal perkuliahan atau tugas yang jatuh pada rentang waktu yang sedang dilihat.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {!hasSemester ? (
            <Button asChild size="sm">
              <Link href="/semesters">Kelola Semester</Link>
            </Button>
          ) : !hasCourses ? (
            <Button asChild size="sm">
              <Link href="/courses">Tambah Mata Kuliah</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <Link href="/schedule">
                  <Plus className="h-3.5 w-3.5" />
                  Tambah Jadwal
                </Link>
              </Button>
              <Button asChild size="sm" className="gap-1.5">
                <Link href="/assignments">
                  <Plus className="h-3.5 w-3.5" />
                  Tambah Tugas
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {sortedDates.map((dateStr) => {
        const isToday = dateStr === todayDateStr;
        const dayEvents = groupedEvents[dateStr] || [];

        return (
          <div key={dateStr} className="space-y-3">
            {/* Header Tanggal */}
            <div className="flex items-center gap-2.5 pb-1 border-b">
              <h3 className="text-sm font-bold text-foreground">
                {formatAgendaDateHeader(dateStr)}
              </h3>
              {isToday && (
                <Badge variant="default" className="text-[10px] px-2 py-0 font-semibold shadow-xs">
                  Hari Ini
                </Badge>
              )}
            </div>

            {/* List Agenda */}
            <div className="grid grid-cols-1 gap-2.5">
              {dayEvents.map((event) => {
                const isSchedule = event.type === 'SCHEDULE';
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onSelectEvent(event)}
                    className={cn(
                      'w-full text-left p-3.5 sm:p-4 rounded-xl border bg-card hover:bg-accent/40 transition-all shadow-xs flex flex-col gap-2 group focus:outline-none focus:ring-2 focus:ring-primary',
                      isSchedule
                        ? 'border-l-4 border-l-primary'
                        : event.isOverdue
                        ? 'border-l-4 border-l-destructive'
                        : event.status === 'DONE'
                        ? 'border-l-4 border-l-muted-foreground/40'
                        : 'border-l-4 border-l-amber-500'
                    )}
                  >
                    {/* Top Row: Type Badge + Time */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        {isSchedule ? (
                          <Badge
                            variant="outline"
                            className="bg-primary/10 text-primary border-primary/20 text-xs gap-1 font-semibold"
                          >
                            <CalendarClock className="h-3.5 w-3.5" />
                            Kuliah
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-xs gap-1 font-semibold"
                          >
                            <ListTodo className="h-3.5 w-3.5" />
                            Tugas
                          </Badge>
                        )}
                        {event.courseCode && (
                          <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {event.courseCode}
                          </span>
                        )}
                      </div>

                      <span className="text-xs font-mono text-muted-foreground flex items-center gap-1 font-medium">
                        <Clock className="h-3.5 w-3.5" />
                        {isSchedule ? `${event.startTime} – ${event.endTime}` : `Tenggat: ${event.dueTime}`}
                      </span>
                    </div>

                    {/* Middle Row: Title + Course */}
                    <div>
                      <h4 className="font-bold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors">
                        {event.title}
                      </h4>
                      <p className="text-xs text-muted-foreground font-medium mt-0.5">
                        {event.courseName}
                      </p>
                    </div>

                    {/* Bottom Row: Metadata (Room / Status / Priority) */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 text-xs text-muted-foreground flex-wrap">
                      {isSchedule ? (
                        <div className="flex items-center gap-3">
                          {event.room && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-primary" />
                              {event.room}
                            </span>
                          )}
                          {event.lecturer && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3 text-primary" />
                              {event.lecturer}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {event.priority && (
                            <span>
                              Prioritas:{' '}
                              <strong>
                                {event.priority === 'HIGH'
                                  ? 'Tinggi'
                                  : event.priority === 'MEDIUM'
                                  ? 'Sedang'
                                  : 'Rendah'}
                              </strong>
                            </span>
                          )}
                          {event.isOverdue && (
                            <span className="text-destructive font-semibold flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Terlewat
                            </span>
                          )}
                          {event.status === 'DONE' && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Selesai
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
