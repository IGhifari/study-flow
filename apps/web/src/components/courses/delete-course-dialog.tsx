'use client';

import * as React from 'react';
import { Course } from '@studyflow/shared';
import { deleteCourse } from '@/lib/course-client';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export interface DeleteCourseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: Course | null;
  onSuccess: () => void;
}

export function DeleteCourseDialog({
  open,
  onOpenChange,
  course,
  onSuccess,
}: DeleteCourseDialogProps): React.JSX.Element {
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setErrorMsg(null);
    }
  }, [open]);

  const handleDelete = async () => {
    if (!course) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await deleteCourse(course.id);
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menghapus mata kuliah.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Hapus Mata Kuliah</DialogTitle>
          <DialogDescription>
            Apakah Anda yakin ingin menghapus mata kuliah{' '}
            <strong className="text-foreground">{course?.name}</strong>? Tindakan ini tidak dapat dibatalkan.
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        <p className="text-xs text-muted-foreground">
          Mata kuliah yang masih memiliki materi, tugas, atau catatan aktif tidak dapat dihapus. Anda dapat menggunakan opsi arsip jika perkuliahan telah selesai.
        </p>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Menghapus...
              </>
            ) : (
              'Hapus Mata Kuliah'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
