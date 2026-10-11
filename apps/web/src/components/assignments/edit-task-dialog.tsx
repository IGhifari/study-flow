'use client';

import * as React from 'react';
import { Assignment, toUserDateTimeInputValue } from '@studyflow/shared';
import { updateAssignment } from '@/lib/assignment-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
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

export interface EditTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: Assignment | null;
  timezone?: string;
  onSuccess: () => void;
}

export function EditTaskDialog({
  open,
  onOpenChange,
  assignment,
  timezone = 'Asia/Jakarta',
  onSuccess,
}: EditTaskDialogProps): React.JSX.Element {
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');
  const [priority, setPriority] = React.useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [status, setStatus] = React.useState<'TODO' | 'IN_PROGRESS' | 'DONE'>('TODO');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const activeAssignmentIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (open && assignment) {
      if (activeAssignmentIdRef.current !== assignment.id) {
        setErrorMsg(null);
        setTitle(assignment.title);
        setDescription(assignment.description || '');
        setDueDate(toUserDateTimeInputValue(assignment.dueDate, timezone));
        setPriority(assignment.priority);
        setStatus(assignment.status);
        activeAssignmentIdRef.current = assignment.id;
      }
    } else {
      activeAssignmentIdRef.current = null;
    }
  }, [open, assignment, timezone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignment) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle || trimmedTitle.length < 2) {
      setErrorMsg('Judul tugas minimal 2 karakter.');
      return;
    }
    if (!dueDate) {
      setErrorMsg('Tenggat waktu wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await updateAssignment(assignment.id, {
        title: trimmedTitle,
        description: description.trim() || undefined,
        dueDate,
        priority,
        status,
      });

      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memperbarui tugas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <form noValidate onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Edit Tugas</DialogTitle>
            <DialogDescription>
              Perbarui judul, tenggat waktu, prioritas, atau status tugas ini.
            </DialogDescription>
          </DialogHeader>

          {errorMsg && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          {/* Mata Kuliah (Disabled) */}
          <div className="space-y-1.5">
            <Label>Mata Kuliah</Label>
            <Input
              value={assignment?.course?.name || 'Mata Kuliah'}
              disabled
              className="bg-muted text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Mata kuliah tidak dapat dipindahkan setelah tugas dibuat.
            </p>
          </div>

          {/* Judul Tugas */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-title">Judul Tugas *</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              required
              minLength={2}
              maxLength={200}
            />
          </div>

          {/* Tenggat Waktu */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-due">Tenggat Waktu *</Label>
            <Input
              id="edit-due"
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={isSubmitting}
              required
            />
            <p className="text-xs text-muted-foreground">
              Zona waktu profil: <strong className="text-foreground">{timezone}</strong>.
            </p>
          </div>

          {/* Prioritas & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-priority">Prioritas</Label>
              <NativeSelect
                id="edit-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                disabled={isSubmitting}
              >
                <option value="LOW">Rendah</option>
                <option value="MEDIUM">Sedang</option>
                <option value="HIGH">Tinggi</option>
              </NativeSelect>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-status">Status</Label>
              <NativeSelect
                id="edit-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                disabled={isSubmitting}
              >
                <option value="TODO">Belum Dikerjakan</option>
                <option value="IN_PROGRESS">Sedang Dikerjakan</option>
                <option value="DONE">Selesai</option>
              </NativeSelect>
            </div>
          </div>

          {/* Deskripsi */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-desc">Deskripsi / Catatan (Opsional)</Label>
            <Textarea
              id="edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              rows={3}
              maxLength={2000}
            />
          </div>

          <DialogFooter className="pt-2 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="standard"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button type="submit" size="standard" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Memperbarui...
                </>
              ) : (
                'Simpan Perubahan'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
