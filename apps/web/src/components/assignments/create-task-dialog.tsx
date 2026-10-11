'use client';

import * as React from 'react';
import { Course } from '@studyflow/shared';
import { createAssignment } from '@/lib/assignment-client';
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

  React.useEffect(() => {
    if (open) {
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
  }, [open, initialCourseId, activeCourses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle || trimmedTitle.length < 2) {
      setErrorMsg('Judul tugas minimal 2 karakter.');
      return;
    }
    if (!courseId) {
      setErrorMsg('Mata kuliah wajib dipilih.');
      return;
    }
    if (!dueDate) {
      setErrorMsg('Tenggat waktu wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await createAssignment({
        courseId,
        title: trimmedTitle,
        description: description.trim() || undefined,
        dueDate,
        priority,
        status,
      });

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
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <NativeSelect
              id={courseInputId}
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              disabled={isSubmitting || activeCourses.length === 0}
              required
            >
              <option value="" disabled>
                Pilih mata kuliah aktif
              </option>
              {activeCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.code ? `(${c.code})` : ''}
                </option>
              ))}
            </NativeSelect>
          </div>

          {/* Tenggat Waktu */}
          <div className="space-y-1.5">
            <Label htmlFor={dueId}>Tenggat Waktu *</Label>
            <Input
              id={dueId}
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={isSubmitting}
              required
            />
            <p className="text-xs text-muted-foreground">
              Zona waktu profil: <strong className="text-foreground">{timezone}</strong>. Jika jam tidak ditentukan, deadline otomatis diatur ke 23.59.
            </p>
          </div>

          {/* Prioritas & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={priorityId}>Prioritas</Label>
              <NativeSelect
                id={priorityId}
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
              <Label htmlFor={statusId}>Status</Label>
              <NativeSelect
                id={statusId}
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
            <Label htmlFor={descId}>Deskripsi / Catatan (Opsional)</Label>
            <Textarea
              id={descId}
              placeholder="Instruksi pengerjaan, format berkas, atau catatan penting..."
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
