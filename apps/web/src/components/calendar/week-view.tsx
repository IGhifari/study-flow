'use client';

import * as React from 'react';
import {
  CalendarClock,
  ListTodo,
  MapPin,
  AlertCircle,
} from 'lucide-react';
import { CalendarEvent } from '@studyflow/shared';
import {
  SHORT_DAY_NAMES,
  INDONESIAN_MONTH_NAMES,
  parseDateString,
  groupEventsByDate,
} from '@/lib/calendar-utils';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface WeekViewProps {
  days: string[]; // 7 days (YYYY-MM-DD) from Monday to Sunday
  todayDateStr: string;
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
}

export function WeekView({
  days,
  todayDateStr,
  events,
  onSelectEvent,
}: WeekViewProps): React.JSX.Element {
  const groupedEvents = React.useMemo(() => groupEventsByDate(events), [events]);

  return (
    <Card className="w-full overflow-hidden shadow-xs">
      {/* 7-column grid */}
      <div className="grid grid-cols-7 divide-x divide-border min-h-[500px]">
        {days.map((dateStr, index) => {
          const { month, day } = parseDateString(dateStr);
          const isToday = dateStr === todayDateStr;
          const dayName = SHORT_DAY_NAMES[index] || '';
          const monthShort = INDONESIAN_MONTH_NAMES[month - 1]?.slice(0, 3) || '';
          const dayEvents = groupedEvents[dateStr] || [];

          return (
            <div
              key={dateStr}
              className={cn(
                'flex flex-col h-full transition-colors',
                isToday ? 'bg-primary/5 dark:bg-primary/10' : 'bg-card'
              )}
            >
              {/* Column Header */}
              <div
                className={cn(
                  'p-3 border-b text-center sticky top-0 z-10 bg-background/90 backdrop-blur-xs',
                  isToday && 'border-b-primary bg-primary/10'
                )}
              >
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {dayName}
                </div>
                <div
                  className={cn(
                    'mt-1 inline-flex items-center justify-center rounded-full h-8 w-8 text-sm font-bold tabular-nums',
                    isToday ? 'bg-primary text-primary-foreground shadow-xs' : 'text-foreground'
                  )}
                >
                  {day}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{monthShort}</div>
              </div>

              {/* Event Cards inside column */}
              <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[650px]">
                {dayEvents.length === 0 ? (
                  <div className="h-24 flex items-center justify-center text-xs text-muted-foreground/60 italic text-center">
                    Tidak ada agenda
                  </div>
                ) : (
                  dayEvents.map((event) => {
                    const isSchedule = event.type === 'SCHEDULE';
                    return (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => onSelectEvent(event)}
                        className={cn(
                          'w-full text-left p-2.5 rounded-lg border transition-all text-xs focus:outline-none focus:ring-2 focus:ring-primary',
                          isSchedule
                            ? 'bg-primary/5 border-primary/20 hover:bg-primary/10 text-foreground'
                            : event.isOverdue
                            ? 'bg-destructive/10 border-destructive/30 hover:bg-destructive/20 text-foreground'
                            : event.status === 'DONE'
                            ? 'bg-muted/60 border-border hover:bg-muted text-muted-foreground line-through'
                            : 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20 text-foreground'
                        )}
                      >
                        {/* Header card: Badge & Time */}
                        <div className="flex items-center justify-between gap-1 mb-1">
                          {isSchedule ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-xs text-primary">
                              <CalendarClock className="h-3 w-3" />
                              Kuliah
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-semibold text-xs text-amber-700 dark:text-amber-400">
                              <ListTodo className="h-3 w-3" />
                              Tugas
                            </span>
                          )}

                          <span className="font-mono text-xs tabular-nums text-muted-foreground">
                            {isSchedule ? event.startTime : event.dueTime}
                          </span>
                        </div>

                        {/* Title */}
                        <div className="font-bold text-xs leading-snug line-clamp-2 mb-1">
                          {event.title}
                        </div>

                        {/* Course Name */}
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {event.courseName}
                        </div>

                        {/* Extra: Room or Overdue/Status */}
                        {isSchedule && event.room && (
                          <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 text-primary shrink-0" />
                            <span className="truncate">{event.room}</span>
                          </div>
                        )}

                        {!isSchedule && event.isOverdue && (
                          <div className="mt-1 flex items-center gap-1 text-xs text-destructive font-semibold">
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            Terlewat
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
