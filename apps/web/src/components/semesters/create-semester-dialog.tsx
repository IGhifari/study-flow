'use client';

import * as React from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { CreateSemesterInput, CreateSemesterInputSchema } from '@studyflow/shared';
import { createSemester } from '@/lib/semester-client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CreateSemesterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void> | void;
}

export function CreateSemesterDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateSemesterDialogProps): React.JSX.Element {
  const [name, setName] = React.useState('');
  const [academicYear, setAcademicYear] = React.useState('');
  const [makeActive, setMakeActive] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const wasOpenRef = React.useRef(false);

  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      setName('');
      setAcademicYear('');
      setMakeActive(false);
      setError(null);
    }
    wasOpenRef.current = open;
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationResult = CreateSemesterInputSchema.safeParse({
      name: name.trim(),
      academicYear: academicYear.trim(),
      makeActive,
    });

    if (!validationResult.success) {
      setError(validationResult.error.issues[0]?.message || 'Input semester tidak valid.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createSemester(validationResult.data);
      await onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Gagal membuat semester baru. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <form noValidate onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Tambah Semester Baru</DialogTitle>
            <DialogDescription>
              Masukkan periode perkuliahan untuk mengorganisasi mata kuliah dan jadwal belajar Anda.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="create-sem-name">
                Nama Semester <span className="text-danger">*</span>
              </Label>
              <Input
                id="create-sem-name"
                placeholder="Contoh: Semester Ganjil 2026/2027"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-sem-year">
                Tahun Ajaran <span className="text-danger">*</span>
              </Label>
              <Input
                id="create-sem-year"
                placeholder="Contoh: 2026/2027"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="create-sem-active"
                checked={makeActive}
                onChange={(e) => setMakeActive(e.target.checked)}
                disabled={isSubmitting}
                className="h-4 w-4 rounded-sm border-input text-primary focus:ring-primary"
              />
              <Label htmlFor="create-sem-active" className="cursor-pointer text-xs font-normal text-muted-foreground">
                Jadikan semester aktif saat ini
              </Label>
            </div>
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
                'Simpan Semester'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
