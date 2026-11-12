'use client';

import * as React from 'react';
import { Course, CreateAssignmentInputSchema } from '@studyflow/shared';
import { createAssignment } from '@/lib/assignment-client';
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

export interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: Course[];
  initialCourseId?: string;
  timezone?: string;
  idPrefix?: 'create' | 'task';
  onSuccess: () => void;
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  courses,
  initialCourseId,
  timezone = 'Asia/Jakarta',
  idPrefix = 'create',
  onSuccess,
}: CreateTaskDialogProps): React.JSX.Element {
  const [courseId, setCourseId] = React.useState(initialCourseId || '');
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');
  const [priority, setPriority] = React.useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [status, setStatus] = React.useState<'TODO' | 'IN_PROGRESS' | 'DONE'>('TODO');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const titleId = idPrefix === 'task' ? 'task-title' : 'create-title';
  const courseInputId = idPrefix === 'task' ? 'task-course' : 'create-course';
  const dueId = idPrefix === 'task' ? 'task-duedate' : 'create-due';
  const priorityId = idPrefix === 'task' ? 'task-priority' : 'create-priority';
  const statusId = idPrefix === 'task' ? 'task-status' : 'create-status';
  const descId = idPrefix === 'task' ? 'task-desc' : 'create-desc';

  const activeCourses = React.useMemo(
    () => courses.filter((c) => !c.archivedAt),
    [courses]
  );

  const wasOpenRef = React.useRef(false);

  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      setErrorMsg(null);
      setTitle('');
      setDescription('');
      setDueDate('');
      setPriority('MEDIUM');
      setStatus('TODO');

      if (initialCourseId) {
        setCourseId(initialCourseId);
      } else if (activeCourses.length > 0) {
        setCourseId(activeCourses[0]!.id);
      } else {
        setCourseId('');
      }
    }
    wasOpenRef.current = open;
  }, [open, initialCourseId, activeCourses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationResult = CreateAssignmentInputSchema.safeParse({
      courseId,
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate,
      priority,
      status,
    });

    if (!validationResult.success) {
      setErrorMsg(validationResult.error.issues[0]?.message || 'Input tugas tidak valid.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await createAssignment(validationResult.data);

      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menambahkan tugas baru.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <form noValidate onSubmit={handleSubmit} className="space-y-3.5">
          <DialogHeader>
            <DialogTitle>Tambah Tugas Baru</DialogTitle>
            <DialogDescription>
              Catat tugas akademik atau praktikum beserta tenggat waktu dan tingkat prioritasnya.
            </DialogDescription>
          </DialogHeader>

          {errorMsg && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          {/* Judul Tugas */}
          <div className="space-y-1.5">
            <Label htmlFor={titleId}>Judul Tugas *</Label>
            <Input
              id={titleId}
              placeholder="Contoh: Makalah Sistem Terdistribusi"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              required
              minLength={2}
              maxLength={200}
            />
          </div>

          {/* Pilihan Mata Kuliah */}
          <div className="space-y-1.5">
            <Label htmlFor={courseInputId}>Mata Kuliah *</Label>
            <Select
              value={courseId}
              onValueChange={(val) => setCourseId(val)}
              disabled={isSubmitting || activeCourses.length === 0}
            >
              <SelectTrigger id={courseInputId} className="w-full">
                <SelectValue placeholder="Pilih mata kuliah aktif" />
              </SelectTrigger>
              <SelectContent>
                {activeCourses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tenggat Waktu */}
          <div className="space-y-1.5">
            <Label htmlFor={dueId}>Tenggat Waktu *</Label>
            <DateTimePicker
              id={dueId}
              value={dueDate}
              onChange={setDueDate}
              disabled={isSubmitting}
              required
              timezone={timezone}
            />
            <p className="text-xs text-muted-foreground">
              Zona waktu profil: <strong className="text-foreground">{timezone}</strong>. Jika jam tidak ditentukan, deadline otomatis diatur ke 23.59.
            </p>
          </div>

          {/* Prioritas & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={priorityId}>Prioritas</Label>
              <Select
                value={priority}
                onValueChange={(val) => setPriority(val as any)}
                disabled={isSubmitting}
              >
                <SelectTrigger id={priorityId} className="w-full">
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
              <Label htmlFor={statusId}>Status</Label>
              <Select
                value={status}
                onValueChange={(val) => setStatus(val as any)}
                disabled={isSubmitting}
              >
                <SelectTrigger id={statusId} className="w-full">
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
            <Label htmlFor={descId}>Deskripsi / Catatan (Opsional)</Label>
            <Textarea
              id={descId}
              placeholder="Instruksi pengerjaan, format berkas, atau catatan penting..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              rows={2}
              className="min-h-[64px]"
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
            <Button
              type="submit"
              size="standard"
              disabled={isSubmitting || activeCourses.length === 0}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                'Simpan Tugas'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
