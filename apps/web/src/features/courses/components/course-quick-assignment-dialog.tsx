'use client';

import * as React from 'react';
import { CreateAssignmentInputSchema } from '@studyflow/shared';
import { AlertCircle, Loader2 } from 'lucide-react';
import { createAssignment } from '@/lib/assignment-client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DateTimePicker } from '@/components/ui/date-picker';
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
import {
  RadixSelect as Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface CourseQuickAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  courseName: string;
  timezone: string;
  onSuccess: () => void;
}

export function CourseQuickAssignmentDialog({
  open,
  onOpenChange,
  courseId,
  courseName,
  timezone,
  onSuccess,
}: CourseQuickAssignmentDialogProps): React.JSX.Element {
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');
  const [priority, setPriority] = React.useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setDueDate('');
      setPriority('MEDIUM');
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationResult = CreateAssignmentInputSchema.safeParse({
      courseId,
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate,
      priority,
      status: 'TODO',
    });

    if (!validationResult.success) {
      setError(validationResult.error.issues[0]?.message || 'Input tugas tidak valid');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await createAssignment(validationResult.data);
      onOpenChange(false);
      setTitle('');
      setDescription('');
      setDueDate('');
      onSuccess();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Gagal menambahkan tugas baru'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <DialogHeader>
          <DialogTitle>Tambah Tugas untuk {courseName}</DialogTitle>
          <DialogDescription>
            Catat tugas perkuliahan baru dengan tenggat waktu dan tingkat prioritas.
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
            <Label htmlFor="course-asg-title">Judul Tugas *</Label>
            <Input
              id="course-asg-title"
              placeholder="Contoh: Makalah Pertemuan 4"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="course-asg-due">Tenggat Waktu *</Label>
            <DateTimePicker
              id="course-asg-due"
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

          <div className="space-y-1.5">
            <Label htmlFor="course-asg-priority">Prioritas *</Label>
            <Select
              value={priority}
              onValueChange={(val) => setPriority(val as 'LOW' | 'MEDIUM' | 'HIGH')}
              disabled={isSubmitting}
            >
              <SelectTrigger id="course-asg-priority" className="w-full">
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
            <Label htmlFor="course-asg-desc">Deskripsi (Opsional)</Label>
            <Textarea
              id="course-asg-desc"
              placeholder="Petunjuk tugas, tautan pengumpulan, atau catatan tambahan..."
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
