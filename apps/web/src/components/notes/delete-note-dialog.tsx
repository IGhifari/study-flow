'use client';

import * as React from 'react';
import { NoteListItem } from '@studyflow/shared';
import { deleteNote } from '@/lib/note-client';
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

export interface DeleteNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: NoteListItem | null;
  onSuccess: () => void;
}

export function DeleteNoteDialog({
  open,
  onOpenChange,
  note,
  onSuccess,
}: DeleteNoteDialogProps): React.JSX.Element {
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setErrorMsg(null);
    }
  }, [open]);

  const handleDelete = async () => {
    if (!note) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await deleteNote(note.id);
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menghapus catatan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Hapus Catatan</DialogTitle>
          <DialogDescription>
            Apakah Anda yakin ingin menghapus catatan{' '}
            <strong className="text-foreground break-words">{note?.title}</strong>? Tindakan ini tidak dapat dibatalkan dan catatan akan dihapus secara permanen.
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        <DialogFooter className="pt-2 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <Button
            variant="outline"
            size="standard"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Batal
          </Button>
          <Button
            variant="destructive"
            size="standard"
            onClick={handleDelete}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Menghapus...
              </>
            ) : (
              'Hapus Catatan'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
