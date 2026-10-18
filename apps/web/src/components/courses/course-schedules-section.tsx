'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  ExternalLink,
  Plus,
  AlertTriangle,
  Clock,
  MapPin,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Course, CourseSchedule, getDayNameId } from '@studyflow/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { StaggerGroup, StaggerItem } from '@/components/ui/motion';
import { CourseTabErrorState } from './course-status-states';

export interface CourseSchedulesSectionProps {
  course: Course;
  schedules: CourseSchedule[];
  isLoading: boolean;
  isArchived: boolean;
  conflictBanner: string | null;
  onAddSchedule: () => void;
  onEditSchedule: (schedule: CourseSchedule) => void;
  onDeleteSchedule: (schedule: CourseSchedule) => void;
  error?: string | null;
  onRetry?: () => void;
}

export function CourseSchedulesSection({
  course,
  schedules,
  isLoading,
  isArchived,
  conflictBanner,
  onAddSchedule,
  onEditSchedule,
  onDeleteSchedule,
  error,
  onRetry,
}: CourseSchedulesSectionProps): React.JSX.Element {
  return (
    <Card className="shadow-xs">
      <CardHeader className="p-5 sm:p-6 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0">
        <div>
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary shrink-0" />
            <CardTitle className="text-base font-semibold text-foreground">
              Jadwal Perkuliahan
            </CardTitle>
          </div>
          <CardDescription className="mt-1 text-xs text-muted-foreground">
            Sesi kelas mingguan terstruktur untuk mata kuliah ini.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild className="h-8 gap-1.5 text-xs">
            <Link href={`/schedule?courseId=${course.id}&semesterId=${course.semesterId}`}>
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Buka di Jadwal Mingguan</span>
            </Link>
          </Button>
          {!isArchived && (
            <Button
              size="sm"
              onClick={onAddSchedule}
              className="h-8 gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Tambah jadwal</span>
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-5 sm:p-6 pt-0 space-y-4">
        {/* Status Banner Konflik */}
        {conflictBanner && (
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{conflictBanner}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ) : error ? (
          <CourseTabErrorState
            title="Gagal Memuat Jadwal Perkuliahan"
            errorMessage={error}
            onRetry={onRetry}
          />
        ) : schedules.length === 0 ? (
          <EmptyState
            size="sm"
            icon={CalendarClock}
            title="Belum ada sesi jadwal perkuliahan"
            description="Tambahkan sesi mingguan (hari, rentang jam, dan ruangan) untuk mata kuliah ini."
            headingAs="p"
            action={
              !isArchived && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onAddSchedule}
                  className="gap-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Tambah jadwal pertama</span>
                </Button>
              )
            }
          />
        ) : (
          <StaggerGroup className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {schedules.map((sched) => {
              const dayName = getDayNameId(sched.dayOfWeek);
              return (
                <StaggerItem
                  key={sched.id}
                  className={`flex flex-col justify-between rounded-lg border p-3.5 transition-all ${
                    sched.hasConflict
                      ? 'border-amber-300 dark:border-amber-800 bg-amber-500/5'
                      : 'border-border bg-muted/20 hover:bg-muted/40'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-foreground">
                        {dayName}
                      </span>
                      {sched.hasConflict && (
                        <Badge variant="warning" className="gap-1 text-xs py-0 px-1.5">
                          <AlertTriangle className="h-3 w-3" />
                          <span>Konflik waktu</span>
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-mono font-medium tabular-nums text-foreground">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span>
                        {sched.startTime} – {sched.endTime}
                      </span>
                    </div>

                    {sched.room ? (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="font-medium text-foreground truncate">{sched.room}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        Ruangan belum ditentukan
                      </p>
                    )}

                    {sched.hasConflict && sched.conflicts && sched.conflicts.length > 0 && (
                      <div className="mt-1 rounded border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/30 p-2 text-xs text-amber-800 dark:text-amber-300">
                        <p className="font-medium">Bertabrakan dengan:</p>
                        <ul className="mt-0.5 list-disc list-inside space-y-0.5">
                          {sched.conflicts.map((c) => (
                            <li key={c.id}>
                              {c.courseName} ({c.startTime}–{c.endTime})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {!isArchived && (
                    <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-border/50 pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditSchedule(sched)}
                        className="h-7 px-2 text-xs gap-1"
                      >
                        <Pencil className="h-3 w-3" />
                        <span>Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteSchedule(sched)}
                        className="h-7 px-2 text-xs gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Hapus</span>
                      </Button>
                    </div>
                  )}
                </StaggerItem>
              );
            })}
          </StaggerGroup>
        )}
      </CardContent>
    </Card>
  );
}
