'use client';

import * as React from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { Semester, UpdateSemesterInput } from '@studyflow/shared';
import { updateSemester } from '@/lib/semester-client';
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

interface EditSemesterDialogProps {
  semester: Semester | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void> | void;
}

export function EditSemesterDialog({
  semester,
  onOpenChange,
  onSuccess,
}: EditSemesterDialogProps): React.JSX.Element {
  const [name, setName] = React.useState('');
  const [academicYear, setAcademicYear] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (semester) {
      setName(semester.name);
      setAcademicYear(semester.academicYear);
      setError(null);
    }
  }, [semester]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!semester) return;

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
      const payload: UpdateSemesterInput = {
        name: trimmedName,
        academicYear: trimmedYear,
      };

      await updateSemester(semester.id, payload);
      await onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Gagal memperbarui semester. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={Boolean(semester)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Edit Semester</DialogTitle>
            <DialogDescription>
              Perbarui nama dan tahun ajaran untuk semester ini.
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
              <Label htmlFor="edit-sem-name">
                Nama Semester <span className="text-danger">*</span>
              </Label>
              <Input
                id="edit-sem-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-sem-year">
                Tahun Ajaran <span className="text-danger">*</span>
              </Label>
              <Input
                id="edit-sem-year"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                disabled={isSubmitting}
              />
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
