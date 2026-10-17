'use client';

import * as React from 'react';
import { type Assignment } from '@studyflow/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ConfirmIncompleteSubtasksDialogProps {
  task: Assignment | null;
  onClose: () => void;
  onConfirm: (task: Assignment) => void;
}

export function ConfirmIncompleteSubtasksDialog({
  task,
  onClose,
  onConfirm,
}: ConfirmIncompleteSubtasksDialogProps): React.JSX.Element {
  const remainingCount =
    (task?.subtaskCount?.total ?? 0) - (task?.subtaskCount?.completed ?? 0);

  return (
    <Dialog
      open={Boolean(task)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Selesaikan Tugas?</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            Tugas &quot;{task?.title}&quot; memiliki{' '}
            <strong className="text-foreground">
              {remainingCount} subtugas
            </strong>{' '}
            yang belum selesai. Apakah Anda yakin ingin tetap menandai tugas ini
            sebagai selesai?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="standard"
            onClick={onClose}
          >
            Batal
          </Button>
          <Button
            type="button"
            size="standard"
            onClick={() => {
              if (task) {
                const target = task;
                onClose();
                onConfirm(target);
              }
            }}
          >
            Tetap Selesaikan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
