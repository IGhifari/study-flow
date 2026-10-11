'use client';

import * as React from 'react';
import { Course, Note } from '@studyflow/shared';
import { createNote } from '@/lib/note-client';
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

export interface CreateNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: Course[];
  initialCourseId?: string;
  onSuccess: (note: Note) => void;
}

export function CreateNoteDialog({
  open,
  onOpenChange,
  courses,
  initialCourseId,
  onSuccess,
}: CreateNoteDialogProps): React.JSX.Element {
  const [courseId, setCourseId] = React.useState(initialCourseId || '');
  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const activeCourses = React.useMemo(
    () => courses.filter((c) => !c.archivedAt),
    [courses]
  );

  React.useEffect(() => {
    if (open) {
      setErrorMsg(null);
      setTitle('');
      setContent('');
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
    if (!trimmedTitle) {
      setErrorMsg('Judul catatan wajib diisi.');
      return;
    }
    if (!courseId) {
      setErrorMsg('Mata kuliah wajib dipilih.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const created = await createNote({
        courseId,
        title: trimmedTitle,
        content: content.trim() || '',
      });
      onOpenChange(false);
      onSuccess(created);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal membuat catatan baru.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Buat Catatan Baru</DialogTitle>
            <DialogDescription>
              Tulis judul dan pilih mata kuliah. Anda dapat langsung melengkapi isinya di halaman editor.
            </DialogDescription>
          </DialogHeader>

          {errorMsg && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="create-note-title">Judul Catatan *</Label>
            <Input
              id="create-note-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Rangkuman Bab 3 - Thread dan Concurrency"
              disabled={isSubmitting}
              required
              minLength={1}
              maxLength={150}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-note-course">Mata Kuliah *</Label>
            <NativeSelect
              id="create-note-course"
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

          <div className="space-y-1.5">
            <Label htmlFor="create-note-content">Isi Awal (Opsional - Format Markdown)</Label>
            <Textarea
              id="create-note-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="# Bab 3..."
              disabled={isSubmitting}
              rows={4}
              maxLength={50000}
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
                  Membuat...
                </>
              ) : (
                'Buat & Buka Editor'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
