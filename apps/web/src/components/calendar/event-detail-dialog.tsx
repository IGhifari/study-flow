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
  ExternalLink,
  Calendar,
} from 'lucide-react';
import { CalendarEvent, getDayNameId } from '@studyflow/shared';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatAgendaDateHeader } from '@/lib/calendar-utils';

interface EventDetailDialogProps {
  event: CalendarEvent | null;
  isOpen: boolean;
  onClose: () => void;
  timezone: string;
}

export function EventDetailDialog({
  event,
  isOpen,
  onClose,
  timezone,
}: EventDetailDialogProps): React.JSX.Element {
  if (!event) {
    return <></>;
  }

  const isSchedule = event.type === 'SCHEDULE';
  const formattedDate = formatAgendaDateHeader(event.date);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            {isSchedule ? (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 gap-1">
                <CalendarClock className="h-3.5 w-3.5" />
                Jadwal Kuliah
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 gap-1">
                <ListTodo className="h-3.5 w-3.5" />
                Tugas Kuliah
              </Badge>
            )}
            {event.courseCode && (
              <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {event.courseCode}
              </span>
            )}
          </div>
          <DialogTitle className="text-xl font-bold leading-snug">
            {event.title}
          </DialogTitle>
          <DialogDescription className="text-sm font-medium text-foreground/80">
            {event.courseName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3 text-sm">
          {/* Tanggal & Waktu */}
          <div className="flex items-start gap-3 rounded-lg border p-3 bg-muted/40">
            <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-0.5">
              <div className="font-medium text-foreground">
                {isSchedule
                  ? `Setiap ${getDayNameId(event.dayOfWeek || 1)} (${formattedDate})`
                  : formattedDate}
              </div>
              <div className="text-muted-foreground text-xs">
                {isSchedule ? (
                  <span>
                    Pukul {event.startTime} – {event.endTime} ({timezone})
                  </span>
                ) : (
                  <span>
                    Tenggat pukul {event.dueTime} ({timezone})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Schedule specifics */}
          {isSchedule && (
            <div className="space-y-2">
              {event.room && (
                <div className="flex items-center gap-2.5 text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0 text-primary" />
                  <span>Ruang / Lokasi: <strong className="text-foreground font-medium">{event.room}</strong></span>
                </div>
              )}
              {event.lecturer && (
                <div className="flex items-center gap-2.5 text-muted-foreground">
                  <User className="h-4 w-4 shrink-0 text-primary" />
                  <span>Dosen Pengampu: <strong className="text-foreground font-medium">{event.lecturer}</strong></span>
                </div>
              )}
            </div>
          )}

          {/* Assignment specifics */}
          {!isSchedule && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {/* Priority */}
                {event.priority && (
                  <Badge variant="outline" className="text-xs">
                    Prioritas:{' '}
                    {event.priority === 'HIGH'
                      ? 'Tinggi'
                      : event.priority === 'MEDIUM'
                      ? 'Sedang'
                      : 'Rendah'}
                  </Badge>
                )}

                {/* Status */}
                {event.status === 'DONE' ? (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 gap-1 text-xs">
                    <CheckCircle2 className="h-3 w-3" />
                    Selesai
                  </Badge>
                ) : event.isOverdue ? (
                  <Badge variant="danger" className="gap-1 text-xs">
                    <AlertCircle className="h-3 w-3" />
                    Terlewat
                  </Badge>
                ) : event.status === 'IN_PROGRESS' ? (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 text-xs">
                    Sedang Dikerjakan
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    Belum Dimulai
                  </Badge>
                )}
              </div>

              {event.description && (
                <div className="rounded border p-2.5 bg-background text-xs text-muted-foreground leading-relaxed">
                  {event.description}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 border-t">
          {isSchedule ? (
            <Button asChild variant="outline" size="sm" className="w-full sm:w-auto gap-1.5">
              <Link href={`/schedule?courseId=${event.courseId}`}>
                <ExternalLink className="h-3.5 w-3.5" />
                Buka Jadwal Kuliah
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm" className="w-full sm:w-auto gap-1.5">
              <Link href="/assignments">
                <ExternalLink className="h-3.5 w-3.5" />
                Buka Halaman Tugas
              </Link>
            </Button>
          )}
          <Button variant="default" size="sm" onClick={onClose} className="w-full sm:w-auto">
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
