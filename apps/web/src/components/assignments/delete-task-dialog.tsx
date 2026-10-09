'use client';

import * as React from 'react';
import { Assignment } from '@studyflow/shared';
import { deleteAssignment } from '@/lib/assignment-client';
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

export interface DeleteTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: Assignment | null;
  onSuccess: () => void;
}

export function DeleteTaskDialog({
  open,
  onOpenChange,
  assignment,
  onSuccess,
}: DeleteTaskDialogProps): React.JSX.Element {
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setErrorMsg(null);
    }
  }, [open]);

  const handleDelete = async () => {
    if (!assignment) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await deleteAssignment(assignment.id);
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menghapus tugas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Hapus Tugas</DialogTitle>
          <DialogDescription>
            Apakah Anda yakin ingin menghapus tugas{' '}
            <strong className="text-foreground">{assignment?.title}</strong>? Tindakan ini tidak dapat dibatalkan.
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        <DialogFooter className="pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Batal
          </Button>
          <Button
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
              'Hapus Tugas'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
