'use client';

import * as React from 'react';
import Link from 'next/link';
import { FileText, Plus, Clock, ExternalLink } from 'lucide-react';
import { NoteListItem, formatUserDateTime } from '@studyflow/shared';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { StaggerGroup, StaggerItem } from '@/components/ui/motion';
import { CourseTabErrorState } from './course-status-states';

export interface CourseNotesTabProps {
  notes: NoteListItem[];
  isLoading: boolean;
  isArchived: boolean;
  timezone: string;
  onAddNote: () => void;
  error?: string | null;
  onRetry?: () => void;
}

export function CourseNotesTab({
  notes,
  isLoading,
  isArchived,
  timezone,
  onAddNote,
  error,
  onRetry,
}: CourseNotesTabProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Daftar Catatan Mata Kuliah</h2>
          <p className="text-xs text-muted-foreground">
            Rangkuman materi dan catatan belajar yang terorganisasi.
          </p>
        </div>
        <Button
          size="standard"
          onClick={onAddNote}
          disabled={isArchived}
          className="gap-1.5 shrink-0 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Buat catatan</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      ) : error ? (
        <CourseTabErrorState
          title="Gagal Memuat Catatan Mata Kuliah"
          errorMessage={error}
          onRetry={onRetry}
        />
      ) : notes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Belum ada catatan untuk mata kuliah ini"
          description="Tulis rangkuman materi perkuliahan dengan format Markdown yang rapi."
          action={
            !isArchived && (
              <Button
                size="standard"
                variant="outline"
                onClick={onAddNote}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                <span>Buat catatan pertama</span>
              </Button>
            )
          }
        />
      ) : (
        <StaggerGroup className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((n) => (
            <StaggerItem key={n.id}>
              <Card className="h-full shadow-xs flex flex-col justify-between hover:border-primary/50 transition-colors">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-medium leading-snug">
                    <Link
                      href={`/notes/${n.id}`}
                      className="text-foreground hover:text-primary transition-colors line-clamp-2 break-words"
                    >
                      {n.title}
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-xs text-muted-foreground flex items-center gap-1 tabular-nums">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span>Diperbarui: {formatUserDateTime(n.updatedAt, timezone)}</span>
                  </p>
                </CardContent>
                <CardFooter className="p-4 pt-2.5 border-t border-border justify-end">
                  <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                    <Link href={`/notes/${n.id}`}>
                      Buka Editor
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            </StaggerItem>
          ))}
        </StaggerGroup>
      )}
    </div>
  );
}
