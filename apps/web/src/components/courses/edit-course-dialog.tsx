'use client';

import * as React from 'react';
import { Course, UpdateCourseInput, UpdateCourseInputSchema } from '@studyflow/shared';
import { updateCourse } from '@/lib/course-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export interface EditCourseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: Course | null;
  onSuccess: (updatedCourse: Course) => void;
}

export function EditCourseDialog({
  open,
  onOpenChange,
  course,
  onSuccess,
}: EditCourseDialogProps): React.JSX.Element {
  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const [lecturer, setLecturer] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const lastCourseIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (open && course && lastCourseIdRef.current !== course.id) {
      setErrorMsg(null);
      setName(course.name || '');
      setCode(course.code || '');
      setLecturer(course.lecturer || '');
      setDescription(course.description || '');
      lastCourseIdRef.current = course.id;
    } else if (!open) {
      lastCourseIdRef.current = null;
    }
  }, [open, course]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!course) return;
    setErrorMsg(null);

    const validationResult = UpdateCourseInputSchema.safeParse({
      name: name.trim(),
      code: code.trim() || null,
      lecturer: lecturer.trim() || null,
      description: description.trim() || null,
    });

    if (!validationResult.success) {
      setErrorMsg(validationResult.error.issues[0]?.message || 'Input pembaruan mata kuliah tidak valid');
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await updateCourse(course.id, validationResult.data);
      onOpenChange(false);
      onSuccess(updated);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memperbarui mata kuliah');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Mata Kuliah</DialogTitle>
          <DialogDescription>
            Perbarui detail informasi mata kuliah{' '}
            <strong className="text-foreground">{course?.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        <form noValidate onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-course-name">Nama Mata Kuliah *</Label>
            <Input
              id="edit-course-name"
              placeholder="Contoh: Algoritma & Pemrograman"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-course-code">Kode Mata Kuliah</Label>
              <Input
                id="edit-course-code"
                placeholder="Contoh: IF210"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-course-lecturer">Dosen Pengampu</Label>
              <Input
                id="edit-course-lecturer"
                placeholder="Contoh: Dr. Budi"
                value={lecturer}
                onChange={(e) => setLecturer(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-course-desc">Deskripsi</Label>
            <Textarea
              id="edit-course-desc"
              placeholder="Catatan mengenai silabus, ruang kelas, atau jadwal..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              rows={3}
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
