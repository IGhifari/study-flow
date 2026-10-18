'use client';

import * as React from 'react';
import Link from 'next/link';
import { BookOpen, Clock, FileText, ExternalLink } from 'lucide-react';
import { Note, MaterialListItem, formatUserDateTime } from '@studyflow/shared';
import { Button } from '@/components/ui/button';
import {
  RadixSelect as Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

export interface NoteMetadataBarProps {
  note: Note;
  isArchived: boolean;
  materialId: string | null;
  courseMaterials: MaterialListItem[];
  timezone: string;
  onMaterialChange: (newMaterialId: string | null) => void;
}

export function NoteMetadataBar({
  note,
  isArchived,
  materialId,
  courseMaterials,
  timezone,
  onMaterialChange,
}: NoteMetadataBarProps): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-card/60 backdrop-blur-xs px-4 py-3 text-xs shadow-2xs">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="font-medium text-muted-foreground">Mata Kuliah:</span>
          {note.course ? (
            <Link
              href={`/courses/${note.course.id}`}
              className="font-semibold text-foreground hover:text-primary transition-colors hover:underline"
            >
              {note.course.name}
            </Link>
          ) : (
            <span className="font-semibold text-foreground">—</span>
          )}
        </div>

        {note.updatedAt && (
          <>
            <span className="hidden sm:inline text-border">•</span>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>Diperbarui {formatUserDateTime(note.updatedAt, timezone)}</span>
            </div>
          </>
        )}
      </div>

      {/* Tautan Materi Dropdown */}
      <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
        <span className="text-muted-foreground whitespace-nowrap font-medium">Materi:</span>
        {isArchived ? (
          note.material ? (
            <Link
              href={`/materials/${note.material.id}`}
              className="font-medium text-primary hover:underline flex items-center gap-1.5 max-w-[220px]"
            >
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{note.material.title}</span>
            </Link>
          ) : (
            <span className="text-muted-foreground italic">Tidak terhubung</span>
          )
        ) : (
          <div className="flex items-center gap-1.5">
            <Select
              value={materialId || 'none'}
              onValueChange={(val) => onMaterialChange(val === 'none' ? null : val)}
            >
              <SelectTrigger
                className="h-8 text-xs py-0 w-auto min-w-[200px] max-w-[280px] bg-background"
                aria-label="Pilih Materi Terkait"
              >
                <SelectValue placeholder="Pilih materi terkait..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">— Tidak terhubung ke materi —</span>
                </SelectItem>
                {courseMaterials.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="truncate">{m.title}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {materialId && (
              <Button
                asChild
                variant="ghost"
                size="icon-sm"
                className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                title="Buka materi terkait di tab baru"
              >
                <Link href={`/materials/${materialId}`} target="_blank">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
