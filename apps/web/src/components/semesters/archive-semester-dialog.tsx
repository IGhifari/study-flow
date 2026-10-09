'use client';

import * as React from 'react';
import { Loader2, AlertCircle, Archive } from 'lucide-react';
import { Semester } from '@studyflow/shared';
import { archiveSemester } from '@/lib/semester-client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ArchiveSemesterDialogProps {
  semester: Semester | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void> | void;
}

export function ArchiveSemesterDialog({
  semester,
  onOpenChange,
  onSuccess,
}: ArchiveSemesterDialogProps): React.JSX.Element {
  const [error, setError] = React.useState<string | null>(null);
  const [isArchiving, setIsArchiving] = React.useState(false);

  React.useEffect(() => {
    if (semester) {
      setError(null);
    }
  }, [semester]);

  const handleArchive = async () => {
    if (!semester) return;

    setError(null);
    setIsArchiving(true);
    try {
      await archiveSemester(semester.id);
      await onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Gagal mengarsipkan semester. Silakan coba lagi.');
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <Dialog open={Boolean(semester)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Archive className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Arsipkan Semester</DialogTitle>
              <DialogDescription className="mt-1">
                Simpan riwayat perkuliahan semester ini.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Apakah Anda ingin mengarsipkan semester{' '}
              <strong className="text-foreground">{semester?.name}</strong>?
            </p>
            <div className="rounded-lg border border-border bg-muted/60 p-3 text-xs space-y-1.5">
              <p className="font-medium text-foreground">Konsekuensi pengarsipan:</p>
              <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                <li>Semester ini tidak akan dapat dijadikan semester aktif saat berstatus arsip.</li>
                <li>Seluruh mata kuliah dan materi di dalamnya akan menjadi riwayat read-only.</li>
                <li>Anda dapat memulihkan semester ini kapan saja melalui tab Arsip.</li>
              </ul>
            </div>
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isArchiving}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={handleArchive}
            disabled={isArchiving}
          >
            {isArchiving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Mengarsipkan...
              </>
            ) : (
              'Arsipkan Semester'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
