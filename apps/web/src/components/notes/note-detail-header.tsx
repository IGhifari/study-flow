'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Pin,
  Save,
} from 'lucide-react';
import { Note } from '@studyflow/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export type NoteSaveStatus = 'SAVED' | 'DIRTY' | 'SAVING' | 'ERROR';

export interface NoteDetailHeaderProps {
  note: Note;
  isArchived: boolean;
  saveStatus: NoteSaveStatus;
  lastSavedTime: string | null;
  isPinning: boolean;
  onTogglePin: () => void;
  onSave: () => void;
}

export function NoteDetailHeader({
  note,
  isArchived,
  saveStatus,
  lastSavedTime,
  isPinning,
  onTogglePin,
  onSave,
}: NoteDetailHeaderProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3.5 sm:pb-4">
      <div className="flex items-center gap-3">
        <Button
          asChild
          variant="ghost"
          size="icon-sm"
          className="h-8 w-8 relative after:absolute after:-inset-1.5 sm:after:hidden touch-manipulation text-muted-foreground hover:text-foreground shrink-0"
          aria-label="Kembali ke daftar catatan"
        >
          <Link href="/notes">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Catatan
            </span>
            {isArchived && (
              <Badge variant="outline" className="text-xs border-warning text-warning">
                Arsip (Hanya-baca)
              </Badge>
            )}
          </div>
          {note.course && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <BookOpen className="h-3 w-3 shrink-0 text-muted-foreground" />
              <Link
                href={`/courses/${note.course.id}`}
                className="hover:underline font-medium text-foreground truncate max-w-[240px]"
              >
                {note.course.name}
              </Link>
            </p>
          )}
        </div>
      </div>

      {/* Save Status & Action */}
      <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
        {/* Status Label */}
        <div className="text-xs flex items-center gap-1.5 font-medium">
          {saveStatus === 'SAVING' && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              Menyimpan…
            </span>
          )}
          {saveStatus === 'SAVED' && (
            <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {lastSavedTime ? `Tersimpan pukul ${lastSavedTime}` : 'Tersimpan'}
            </span>
          )}
          {saveStatus === 'DIRTY' && (
            <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              Belum disimpan
            </span>
          )}
          {saveStatus === 'ERROR' && (
            <span className="flex items-center gap-1.5 text-destructive font-semibold">
              <AlertCircle className="h-3.5 w-3.5" />
              Gagal menyimpan
            </span>
          )}
        </div>

        <Button
          variant="outline"
          size="standard"
          onClick={onTogglePin}
          disabled={isPinning || isArchived}
          className="gap-1.5 shrink-0 text-xs"
          title={note.isPinned ? 'Lepas sematan' : 'Sematkan catatan ini'}
          aria-label={note.isPinned ? 'Lepas sematan' : 'Sematkan catatan ini'}
        >
          {isPinning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Pin className={`h-4 w-4 ${note.isPinned ? 'fill-primary text-primary' : ''}`} />
          )}
          <span>{note.isPinned ? 'Disematkan' : 'Sematkan'}</span>
        </Button>

        <Button
          onClick={onSave}
          disabled={saveStatus === 'SAVING' || isArchived}
          size="standard"
          className="gap-1.5 shrink-0"
        >
          {saveStatus === 'SAVING' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          <span>Simpan</span>
        </Button>
      </div>
    </div>
  );
}
