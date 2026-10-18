'use client';

import * as React from 'react';
import { CalendarRange, User, Clock } from 'lucide-react';
import { Course } from '@studyflow/shared';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';

export interface CourseInfoCardProps {
  course: Course;
  isArchived: boolean;
}

export function CourseInfoCard({
  course,
  isArchived,
}: CourseInfoCardProps): React.JSX.Element {
  return (
    <Card className="shadow-xs">
      <CardHeader className="p-5 sm:p-6 pb-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl break-words">
            {course.name}
          </CardTitle>
          {course.code && (
            <Badge variant="outline" className="font-mono text-xs shrink-0">
              {course.code}
            </Badge>
          )}
          {isArchived ? (
            <Badge variant="secondary" className="text-xs text-muted-foreground shrink-0">
              Arsip
            </Badge>
          ) : (
            <Badge variant="default" className="text-xs shrink-0">
              Aktif
            </Badge>
          )}
        </div>
        <CardDescription className="mt-1 text-sm text-muted-foreground">
          Informasi dan keterhubungan materi, tugas, serta catatan kuliah.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-5 sm:p-6 pt-0 space-y-5">
        {/* Metadata Grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 rounded-lg border border-border bg-muted/20 p-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarRange className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Semester</p>
              <p className="font-medium text-sm text-foreground truncate">
                {course.semester ? course.semester.name : 'Tidak terhubung'}
                {course.semester?.isActive && ' (Aktif)'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Dosen Pengampu</p>
              <p className="font-medium text-sm text-foreground truncate">
                {course.lecturer || 'Belum ditentukan'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Clock className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Tahun Ajaran</p>
              <p className="font-medium text-sm text-foreground truncate">
                {course.semester ? course.semester.academicYear : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Description Section */}
        {course.description && (
          <div className="border-t border-border pt-4">
            <h2 className="text-sm font-semibold text-foreground">Deskripsi / Silabus</h2>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground break-words">
              {course.description}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
