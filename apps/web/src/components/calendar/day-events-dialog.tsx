'use client';

import * as React from 'react';
import {
  CalendarClock,
  ListTodo,
  Clock,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { CalendarEvent } from '@studyflow/shared';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatAgendaDateHeader } from '@/lib/calendar-utils';

interface DayEventsDialogProps {
  dateStr: string | null;
  events: CalendarEvent[];
  isOpen: boolean;
  onClose: () => void;
  onSelectEvent: (event: CalendarEvent) => void;
}

export function DayEventsDialog({
  dateStr,
  events,
  isOpen,
  onClose,
  onSelectEvent,
}: DayEventsDialogProps): React.JSX.Element {
  if (!dateStr) return <></>;

  const formattedDate = formatAgendaDateHeader(dateStr);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Agenda Harian</DialogTitle>
          <DialogDescription className="text-sm font-medium text-foreground/80">
            {formattedDate}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto py-2 pr-1">
          {events.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Tidak ada jadwal atau tugas pada tanggal ini.
            </div>
          ) : (
            events.map((event) => {
              const isSchedule = event.type === 'SCHEDULE';
              return (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => {
                    onClose();
                    onSelectEvent(event);
                  }}
                  className="w-full text-left p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors flex items-center justify-between gap-3 group focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {isSchedule ? (
                        <Badge
                          variant="outline"
                          className="bg-primary/10 text-primary border-primary/20 text-[10px] px-1.5 py-0 gap-1 font-normal"
                        >
                          <CalendarClock className="h-3 w-3" />
                          Kuliah
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-[10px] px-1.5 py-0 gap-1 font-normal"
                        >
                          <ListTodo className="h-3 w-3" />
                          Tugas
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                        <Clock className="h-3 w-3" />
                        {isSchedule ? `${event.startTime} - ${event.endTime}` : event.dueTime}
                      </span>
                    </div>

                    <div className="font-semibold text-sm text-foreground truncate">
                      {event.title}
                    </div>

                    <div className="text-xs text-muted-foreground truncate">
                      {event.courseName}
                      {event.room && ` • ${event.room}`}
                    </div>
                  </div>

                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0 transition-transform group-hover:translate-x-0.5" />
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
