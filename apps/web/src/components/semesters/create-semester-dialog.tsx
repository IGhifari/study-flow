'use client';

import * as React from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { CreateSemesterInput } from '@studyflow/shared';
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

  React.useEffect(() => {
    if (open) {
      setName('');
      setAcademicYear('');
      setMakeActive(false);
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedYear = academicYear.trim();

    if (!trimmedName || trimmedName.length < 2) {
      setError('Nama semester wajib diisi minimal 2 karakter.');
      return;
    }
    if (!trimmedYear || trimmedYear.length < 4) {
      setError('Tahun ajaran wajib diisi minimal 4 karakter (contoh: 2026/2027).');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreateSemesterInput = {
        name: trimmedName,
        academicYear: trimmedYear,
        makeActive,
      };

      await createSemester(payload);
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
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit} className="space-y-4">
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
