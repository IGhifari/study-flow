'use client';

import * as React from 'react';
import { CalendarClock, ListTodo, Plus } from 'lucide-react';
import { CalendarEvent } from '@studyflow/shared';
import {
  SHORT_DAY_NAMES,
  parseDateString,
  groupEventsByDate,
} from '@/lib/calendar-utils';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface MonthViewProps {
  days: string[]; // List of YYYY-MM-DD strings for the grid
  activeMonth: number; // 1-12
  activeYear: number;
  todayDateStr: string;
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
  onOpenDayEvents: (dateStr: string, events: CalendarEvent[]) => void;
}

const MAX_VISIBLE_EVENTS = 3;

export function MonthView({
  days,
  activeMonth,
  activeYear,
  todayDateStr,
  events,
  onSelectEvent,
  onOpenDayEvents,
}: MonthViewProps): React.JSX.Element {
  const groupedEvents = React.useMemo(() => groupEventsByDate(events), [events]);

  return (
    <Card className="w-full overflow-hidden shadow-xs">
      {/* 7-column Day Name Headers (Senin – Minggu) */}
      <div className="grid grid-cols-7 border-b bg-muted/60 text-xs font-semibold text-muted-foreground text-center">
        {SHORT_DAY_NAMES.map((name, index) => (
          <div
            key={name}
            className={cn(
              'py-2.5 px-1 truncate border-r last:border-r-0',
              index >= 5 && 'text-amber-600/80 dark:text-amber-400/80' // Akhir pekan
            )}
          >
            {name}
          </div>
        ))}
      </div>

      {/* Grid of days */}
      <div className="grid grid-cols-7 auto-rows-fr divide-y divide-border/60">
        {days.map((dateStr) => {
          const { year, month, day } = parseDateString(dateStr);
          const isCurrentMonth = month === activeMonth && year === activeYear;
          const isToday = dateStr === todayDateStr;
          const dayEvents = groupedEvents[dateStr] || [];
          const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_EVENTS);
          const remainingCount = dayEvents.length - MAX_VISIBLE_EVENTS;

          return (
            <div
              key={dateStr}
              className={cn(
                'min-h-[110px] p-1.5 flex flex-col justify-between border-r last:border-r-0 transition-colors',
                !isCurrentMonth ? 'bg-muted/30 text-muted-foreground/50' : 'bg-card text-foreground',
                isToday && 'bg-primary/5 dark:bg-primary/10'
              )}
            >
              {/* Header: Tanggal & Indikator Hari Ini */}
              <div className="flex items-center justify-between mb-1 px-1">
                <span
                  className={cn(
                    'text-xs font-semibold tabular-nums inline-flex items-center justify-center rounded-full h-6 w-6',
                    isToday
                      ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                      : !isCurrentMonth
                      ? 'text-muted-foreground/60'
                      : 'text-foreground'
                  )}
                >
                  {day}
                </span>

                {dayEvents.length > 0 && (
                  <span className="text-xs font-mono tabular-nums text-muted-foreground hidden sm:inline">
                    {dayEvents.length}
                  </span>
                )}
              </div>

              {/* Event Chips List */}
              <div className="flex-1 space-y-1 overflow-hidden">
                {visibleEvents.map((event) => {
                  const isSchedule = event.type === 'SCHEDULE';
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => onSelectEvent(event)}
                      title={`${event.title} (${isSchedule ? `${event.startTime} - ${event.endTime}` : `Tenggat ${event.dueTime}`})`}
                      className={cn(
                        'w-full text-left rounded px-1.5 py-0.5 text-xs font-medium truncate flex items-center gap-1 transition-all border focus:outline-none focus:ring-1 focus:ring-primary',
                        isSchedule
                          ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20'
                          : event.isOverdue
                          ? 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20'
                          : event.status === 'DONE'
                          ? 'bg-muted text-muted-foreground border-border hover:bg-muted/80 line-through'
                          : 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20 hover:bg-amber-500/20'
                      )}
                    >
                      {isSchedule ? (
                        <CalendarClock className="h-3 w-3 shrink-0" />
                      ) : (
                        <ListTodo className="h-3 w-3 shrink-0" />
                      )}
                      <span className="shrink-0 font-mono text-xs tabular-nums">
                        {isSchedule ? event.startTime : event.dueTime}
                      </span>
                      <span className="truncate">{event.title}</span>
                    </button>
                  );
                })}
              </div>

              {/* "+N lainnya" button */}
              {remainingCount > 0 && (
                <button
                  type="button"
                  onClick={() => onOpenDayEvents(dateStr, dayEvents)}
                  className="mt-1 text-xs tabular-nums text-primary hover:text-primary/80 font-semibold px-1 py-0.5 rounded hover:bg-primary/10 text-left transition-colors flex items-center gap-0.5"
                >
                  <Plus className="h-2.5 w-2.5" />
                  {remainingCount} lainnya
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
