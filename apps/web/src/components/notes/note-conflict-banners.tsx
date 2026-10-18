'use client';

import * as React from 'react';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export interface NoteVersionConflict {
  currentVersion: number;
  message: string;
}

export interface NoteConflictBannersProps {
  isArchived: boolean;
  versionConflict: NoteVersionConflict | null;
  saveErrorMessage: string | null;
  onReloadServerVersion: () => void;
  onForceOverwrite: () => void;
  onDismissSaveError: () => void;
}

export function NoteConflictBanners({
  isArchived,
  versionConflict,
  saveErrorMessage,
  onReloadServerVersion,
  onForceOverwrite,
  onDismissSaveError,
}: NoteConflictBannersProps): React.JSX.Element | null {
  return (
    <>
      {/* 1. Banner Arsip jika Read-only */}
      {isArchived && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Mata kuliah diarsipkan</AlertTitle>
          <AlertDescription>
            Catatan ini bersifat <strong>hanya-baca</strong> karena mata kuliah atau semesternya sedang diarsipkan.
          </AlertDescription>
        </Alert>
      )}

      {/* 2. Version Conflict Banner */}
      {versionConflict && (
        <Alert variant="destructive">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>
            Konflik Versi Catatan (Versi Server: {versionConflict.currentVersion})
          </AlertTitle>
          <AlertDescription className="space-y-2 mt-1">
            <p className="text-xs">
              {versionConflict.message} Tulisan Anda saat ini masih berada di editor ini. Pilih tindakan penyelesaian di bawah:
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={onReloadServerVersion}
                className="text-xs"
              >
                Muat Ulang Versi Server (Buang Lokal)
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={onForceOverwrite}
                className="text-xs"
              >
                Timpa Server dengan Tulisan Ini
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* 3. Save Error Feedback */}
      {saveErrorMessage && !versionConflict && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{saveErrorMessage}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismissSaveError}
              className="h-6 px-1.5 text-xs"
            >
              Tutup
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
