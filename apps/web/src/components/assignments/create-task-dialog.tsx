'use client';

import * as React from 'react';
import { Course } from '@studyflow/shared';
import { createAssignment } from '@/lib/assignment-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: Course[];
  initialCourseId?: string;
  onSuccess: () => void;
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  courses,
  initialCourseId,
  onSuccess,
}: CreateTaskDialogProps): React.JSX.Element {
  const [courseId, setCourseId] = React.useState(initialCourseId || '');
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');
  const [priority, setPriority] = React.useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setErrorMsg(null);
      if (initialCourseId) {
        setCourseId(initialCourseId);
      } else if (courses.length > 0 && !courseId) {
        setCourseId(courses[0]!.id);
      }
    }
  }, [open, initialCourseId, courses, courseId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Judul tugas wajib diisi.');
      return;
    }
    if (!courseId) {
      setErrorMsg('Mata kuliah wajib dipilih.');
      return;
    }
    if (!dueDate) {
      setErrorMsg('Tanggal tenggat waktu wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await createAssignment({
        courseId,
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate,
        priority,
        status: 'TODO',
      });
      setTitle('');
      setDescription('');
      setDueDate('');
      setPriority('MEDIUM');
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
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Tambah Tugas Baru</DialogTitle>
            <DialogDescription>
              Catat tugas akademik atau praktikum yang perlu dikerjakan semester ini.
            </DialogDescription>
          </DialogHeader>

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger-foreground">
              <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="task-title">Judul Tugas *</Label>
            <Input
              id="task-title"
              placeholder="Contoh: Makalah Perkembangan AI"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-course">Mata Kuliah *</Label>
            <Select
              id="task-course"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              disabled={isSubmitting || courses.length === 0}
              required
            >
              {courses.length === 0 ? (
                <option value="">Tidak ada mata kuliah aktif</option>
              ) : (
                courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ''}
                  </option>
                ))
              )}
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-duedate">Tenggat Waktu *</Label>
              <Input
                id="task-duedate"
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-priority">Prioritas</Label>
              <Select
                id="task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                disabled={isSubmitting}
              >
                <option value="LOW">Rendah</option>
                <option value="MEDIUM">Sedang</option>
                <option value="HIGH">Tinggi</option>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-desc">Catatan / Deskripsi (Opsional)</Label>
            <Textarea
              id="task-desc"
              placeholder="Instruksi pengerjaan, format berkas, atau catatan penting..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              rows={3}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting || courses.length === 0}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
