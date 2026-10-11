'use client';

import * as React from 'react';
import { CourseSchedule, getDayNameId } from '@studyflow/shared';
import { deleteSchedule } from '@/lib/schedule-client';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, AlertTriangle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export interface DeleteScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: CourseSchedule | null;
  onSuccess: (deletedId: string) => void;
}

export function DeleteScheduleDialog({
  open,
  onOpenChange,
  schedule,
  onSuccess,
}: DeleteScheduleDialogProps): React.JSX.Element {
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setErrorMsg(null);
    }
  }, [open]);

  if (!schedule) {
    return <></>;
  }

  const courseTitle = schedule.course?.name || 'Mata Kuliah';
  const dayName = getDayNameId(schedule.dayOfWeek);

  const handleDelete = async () => {
    setErrorMsg(null);
    setIsDeleting(true);

    try {
      await deleteSchedule(schedule.id);
      onOpenChange(false);
      onSuccess(schedule.id);
    } catch (err: any) {
      // Dialog remains open on failure with error message displayed
      setErrorMsg(err.message || 'Gagal menghapus jadwal kuliah');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Hapus Jadwal Kuliah</DialogTitle>
              <DialogDescription className="mt-0.5">
                Konfirmasi penghapusan sesi perkuliahan.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {errorMsg && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs break-words">{errorMsg}</AlertDescription>
            </Alert>
          )}

          <p className="text-sm text-foreground leading-relaxed">
            Apakah Anda yakin ingin menghapus jadwal untuk mata kuliah{' '}
            <strong className="font-semibold text-foreground">
              {courseTitle}
              {schedule.course?.code ? ` (${schedule.course.code})` : ''}
            </strong>{' '}
            pada hari <span className="font-semibold">{dayName}</span> pukul{' '}
            <span className="font-semibold">{schedule.startTime} – {schedule.endTime}</span>
            {schedule.room ? ` di ${schedule.room}` : ''}?
          </p>

          <p className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border">
            Tindakan ini hanya menghapus sesi jadwal waktu ini dan tidak akan menghapus data mata kuliah, materi, atau tugas Anda.
          </p>
        </div>

        <DialogFooter className="pt-3 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
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
            className="gap-1.5"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                <span>Menghapus...</span>
              </>
            ) : (
              <span>Ya, Hapus Jadwal</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
