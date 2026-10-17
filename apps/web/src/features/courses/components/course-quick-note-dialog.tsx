'use client';

import * as React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { createNote } from '@/lib/note-client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface CourseQuickNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  courseName: string;
  onNoteCreated: (noteId: string) => void;
}

export function CourseQuickNoteDialog({
  open,
  onOpenChange,
  courseId,
  courseName,
  onNoteCreated,
}: CourseQuickNoteDialogProps): React.JSX.Element {
  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setTitle('');
      setContent('');
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Judul catatan wajib diisi');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const created = await createNote({
        courseId,
        title: title.trim(),
        content: content.trim() || '',
      });
      onOpenChange(false);
      setTitle('');
      setContent('');
      onNoteCreated(created.id);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Gagal membuat catatan baru'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buat Catatan untuk {courseName}</DialogTitle>
          <DialogDescription>
            Tulis catatan belajar baru yang terhubung ke mata kuliah ini.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form noValidate onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="course-note-title">Judul Catatan *</Label>
            <Input
              id="course-note-title"
              placeholder="Contoh: Rangkuman Bab 1 Dasar Teori"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="course-note-content">Konten Awal Markdown (Opsional)</Label>
            <Textarea
              id="course-note-content"
              placeholder={'# Topik Perkuliahan\n\nTulis poin penting perkuliahan di sini...'}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isSubmitting}
              rows={4}
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
