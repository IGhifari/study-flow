'use client';

import * as React from 'react';
import { Assignment, toUserDateTimeInputValue } from '@studyflow/shared';
import { updateAssignment } from '@/lib/assignment-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  RadixSelect as Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DateTimePicker } from '@/components/ui/date-picker';
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
import { AssignmentSubtaskChecklist } from './assignment-subtask-checklist';

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

  // Subtask count tracked from checklist
  const [subtaskCount, setSubtaskCount] = React.useState<{ total: number; completed: number } | null>(null);
  const [showUnfinishedConfirm, setShowUnfinishedConfirm] = React.useState(false);

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
        setSubtaskCount(assignment.subtaskCount || null);
        activeAssignmentIdRef.current = assignment.id;
      }
    } else {
      activeAssignmentIdRef.current = null;
      setShowUnfinishedConfirm(false);
    }
  }, [open, assignment, timezone]);

  const executeSubmit = async () => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignment) return;

    // Check if user is marking task as DONE with unfinished subtasks
    if (
      status === 'DONE' &&
      assignment.status !== 'DONE' &&
      subtaskCount &&
      subtaskCount.total > 0 &&
      subtaskCount.completed < subtaskCount.total
    ) {
      setShowUnfinishedConfirm(true);
      return;
    }

    await executeSubmit();
  };

  const isArchived = Boolean(
    assignment?.course?.archivedAt || assignment?.course?.semester?.archivedAt
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <form noValidate onSubmit={handleSubmit} className="space-y-3.5">
            <DialogHeader>
              <DialogTitle>Edit Tugas</DialogTitle>
              <DialogDescription>
                Perbarui judul, tenggat waktu, prioritas, status, atau kelola checklist subtugas.
              </DialogDescription>
            </DialogHeader>

            {errorMsg && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}

            {/* Mata Kuliah (Informational / Readonly) */}
            {assignment?.course && (
              <div className="rounded-lg bg-muted/40 p-2.5 border border-border/50 text-xs">
                <span className="text-muted-foreground">Mata Kuliah:</span>{' '}
                <span className="font-semibold text-foreground">
                  {assignment.course.name}
                  {assignment.course.code ? ` (${assignment.course.code})` : ''}
                </span>
                {isArchived && (
                  <span className="ml-2 text-destructive font-medium">
                    (Mata Kuliah / Semester Diarsipkan — Hanya Baca)
                  </span>
                )}
              </div>
            )}

            {/* Judul Tugas */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-title">
                Judul Tugas <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Misal: Tugas Proyek Akhir"
                disabled={isSubmitting || isArchived}
                required
                maxLength={200}
              />
            </div>

            {/* Tenggat Waktu (Due Date) */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-due-date">
                Batas Waktu (Tenggat) <span className="text-destructive">*</span>
              </Label>
              <DateTimePicker
                id="edit-due-date"
                value={dueDate}
                onChange={(val) => setDueDate(val)}
                disabled={isSubmitting || isArchived}
                placeholder="Pilih tanggal & jam tenggat waktu"
              />
            </div>

            {/* Grid Prioritas & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-priority">Prioritas</Label>
                <Select
                  value={priority}
                  onValueChange={(val) => setPriority(val as any)}
                  disabled={isSubmitting || isArchived}
                >
                  <SelectTrigger id="edit-priority" className="w-full">
                    <SelectValue placeholder="Pilih prioritas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Rendah</SelectItem>
                    <SelectItem value="MEDIUM">Sedang</SelectItem>
                    <SelectItem value="HIGH">Tinggi</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-status">Status</Label>
                <Select
                  value={status}
                  onValueChange={(val) => setStatus(val as any)}
                  disabled={isSubmitting || isArchived}
                >
                  <SelectTrigger id="edit-status" className="w-full">
                    <SelectValue placeholder="Pilih status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODO">Belum Dikerjakan</SelectItem>
                    <SelectItem value="IN_PROGRESS">Sedang Dikerjakan</SelectItem>
                    <SelectItem value="DONE">Selesai</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Deskripsi */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-desc">Deskripsi / Catatan (Opsional)</Label>
              <Textarea
                id="edit-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting || isArchived}
                rows={2}
                className="min-h-[64px]"
                maxLength={2000}
              />
            </div>

            {/* Checklist Subtugas */}
            {assignment && (
              <div className="border-t border-border pt-3">
                <AssignmentSubtaskChecklist
                  assignmentId={assignment.id}
                  isParentDone={status === 'DONE'}
                  isArchived={isArchived}
                  onCountChange={(count) => {
                    setSubtaskCount(count);
                  }}
                />
              </div>
            )}

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
              <Button type="submit" size="standard" disabled={isSubmitting || isArchived}>
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

      {/* Confirmation Dialog when completing task with unfinished subtasks */}
      <Dialog open={showUnfinishedConfirm} onOpenChange={setShowUnfinishedConfirm}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Selesaikan Tugas?</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Tugas ini memiliki{' '}
              <strong className="text-foreground">
                {(subtaskCount?.total ?? 0) - (subtaskCount?.completed ?? 0)} subtugas
              </strong>{' '}
              yang belum selesai. Apakah Anda yakin ingin tetap menandai tugas ini sebagai selesai?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="standard"
              onClick={() => setShowUnfinishedConfirm(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              size="standard"
              onClick={() => {
                setShowUnfinishedConfirm(false);
                executeSubmit();
              }}
              disabled={isSubmitting}
            >
              Tetap Selesaikan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
