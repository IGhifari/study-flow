'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Pencil,
  RotateCcw,
  Archive,
  Trash2,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export interface CourseDetailHeaderProps {
  isArchived: boolean;
  actionError: string | null;
  onEdit: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
}

export function CourseDetailHeader({
  isArchived,
  actionError,
  onEdit,
  onArchive,
  onUnarchive,
  onDelete,
}: CourseDetailHeaderProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      {/* 1. Top Navigasi & Aksi Utama */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <Button
          variant="ghost"
          asChild
          size="sm"
          className="h-8 gap-2 text-sm w-fit -ml-2 relative after:absolute after:-inset-1.5 sm:after:hidden touch-manipulation"
        >
          <Link href="/courses">
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali ke Daftar Mata Kuliah</span>
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            disabled={isArchived}
            className="h-8 gap-1.5"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>Edit</span>
          </Button>

          {isArchived ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onUnarchive}
              className="h-8 gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Pulihkan</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={onArchive}
              className="h-8 gap-1.5 text-muted-foreground"
            >
              <Archive className="h-3.5 w-3.5" />
              <span>Arsipkan</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-8 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Hapus</span>
          </Button>
        </div>
      </div>

      {/* Global Action Error Banner */}
      {actionError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {/* Archived Banner */}
      {isArchived && (
        <Alert variant="warning">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle>Mata Kuliah / Semester Diarsipkan (Hanya-Baca)</AlertTitle>
          <AlertDescription className="mt-1">
            Konten tugas dan catatan pada mata kuliah ini bersifat hanya-baca. Pulihkan mata kuliah dan semester untuk menambahkan atau mengedit konten kembali.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
