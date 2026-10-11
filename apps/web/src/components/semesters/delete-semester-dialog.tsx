'use client';

import * as React from 'react';
import { Loader2, AlertCircle, AlertTriangle } from 'lucide-react';
import { Semester } from '@studyflow/shared';
import { deleteSemester } from '@/lib/semester-client';
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

interface DeleteSemesterDialogProps {
  semester: Semester | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void> | void;
}

export function DeleteSemesterDialog({
  semester,
  onOpenChange,
  onSuccess,
}: DeleteSemesterDialogProps): React.JSX.Element {
  const [error, setError] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    if (semester) {
      setError(null);
    }
  }, [semester]);

  const handleDelete = async () => {
    if (!semester) return;

    setError(null);
    setIsDeleting(true);
    try {
      await deleteSemester(semester.id);
      await onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Gagal menghapus semester. Pastikan tidak ada mata kuliah terkait.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={Boolean(semester)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Hapus Semester</DialogTitle>
              <DialogDescription className="mt-1">
                Tindakan ini tidak dapat dibatalkan.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            Apakah Anda yakin ingin menghapus semester{' '}
            <strong className="text-foreground break-words">{semester?.name}</strong> (
            {semester?.academicYear})?
          </p>
          <p className="text-xs bg-muted/60 p-2.5 rounded-lg border border-border">
            Catatan: Sistem menolak penghapusan jika semester telah memiliki mata kuliah di dalamnya.
            Jika perkuliahan telah selesai, disarankan untuk mengarsipkan semester tersebut.
          </p>
        </div>

        <DialogFooter className="pt-2 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="standard"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="standard"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Menghapus...
              </>
            ) : (
              'Hapus Semester'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
