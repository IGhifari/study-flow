'use client';

import * as React from 'react';
import { AlertTriangle, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export interface NoteUnsavedDialogProps {
  open: boolean;
  isSavingAndLeaving: boolean;
  onStayAndEdit: () => void;
  onDiscardAndLeave: () => void;
  onSaveAndLeave: () => void;
}

export function NoteUnsavedDialog({
  open,
  isSavingAndLeaving,
  onStayAndEdit,
  onDiscardAndLeave,
  onSaveAndLeave,
}: NoteUnsavedDialogProps): React.JSX.Element {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isSavingAndLeaving) {
          onStayAndEdit();
        }
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        data-testid="unsaved-changes-dialog"
        aria-describedby="unsaved-changes-description"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            Perubahan Belum Tersimpan
          </DialogTitle>
          <DialogDescription
            id="unsaved-changes-description"
            className="text-sm text-muted-foreground mt-1"
          >
            Catatan ini memiliki perubahan yang belum disimpan. Pilih tindakan yang ingin Anda lakukan sebelum berpindah halaman:
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex flex-col sm:flex-col gap-2 mt-4">
          {/* 1. Simpan dan lanjutkan */}
          <Button
            type="button"
            variant="default"
            onClick={onSaveAndLeave}
            disabled={isSavingAndLeaving}
            className="w-full justify-center gap-2 h-9"
            data-testid="confirm-save-and-leave"
          >
            {isSavingAndLeaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menyimpan dan melanjutkan…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Simpan dan lanjutkan
              </>
            )}
          </Button>

          {/* 2. Buang perubahan dan lanjutkan */}
          <Button
            type="button"
            variant="destructive"
            onClick={onDiscardAndLeave}
            disabled={isSavingAndLeaving}
            className="w-full justify-center h-9"
            data-testid="confirm-discard-and-leave"
          >
            Buang perubahan dan lanjutkan
          </Button>

          {/* 3. Tetap mengedit */}
          <Button
            type="button"
            variant="outline"
            onClick={onStayAndEdit}
            disabled={isSavingAndLeaving}
            className="w-full justify-center h-9"
            data-testid="confirm-stay-and-edit"
          >
            Tetap mengedit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
