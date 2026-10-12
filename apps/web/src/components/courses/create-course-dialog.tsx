'use client';

import * as React from 'react';
import { Course, CreateCourseInput, Semester } from '@studyflow/shared';
import { createCourse } from '@/lib/course-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  RadixSelect as Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
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

export interface CreateCourseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  semesters: Semester[];
  activeSemesterId?: string;
  onSuccess: (newCourse: Course) => void;
}

export function CreateCourseDialog({
  open,
  onOpenChange,
  semesters,
  activeSemesterId,
  onSuccess,
}: CreateCourseDialogProps): React.JSX.Element {
  const [semesterId, setSemesterId] = React.useState('');
  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const [lecturer, setLecturer] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const nonArchivedSemesters = React.useMemo(
    () => semesters.filter((s) => !s.archivedAt),
    [semesters]
  );

  const wasOpenRef = React.useRef(false);

  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      setErrorMsg(null);
      setName('');
      setCode('');
      setLecturer('');
      setDescription('');
      if (activeSemesterId) {
        setSemesterId(activeSemesterId);
      } else if (nonArchivedSemesters.length > 0) {
        setSemesterId(nonArchivedSemesters[0].id);
      } else {
        setSemesterId('');
      }
    }
    wasOpenRef.current = open;
  }, [open, activeSemesterId, nonArchivedSemesters]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!semesterId) {
      setErrorMsg('Silakan pilih semester untuk mata kuliah ini');
      return;
    }
    if (!name.trim()) {
      setErrorMsg('Nama mata kuliah wajib diisi');
      return;
    }
    if (name.trim().length < 2) {
      setErrorMsg('Nama mata kuliah minimal 2 karakter');
      return;
    }

    setIsSubmitting(true);
    try {
      const input: CreateCourseInput = {
        semesterId,
        name: name.trim(),
        code: code.trim() || null,
        lecturer: lecturer.trim() || null,
        description: description.trim() || null,
      };
      const created = await createCourse(input);
      onOpenChange(false);
      onSuccess(created);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menambahkan mata kuliah baru');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tambah Mata Kuliah</DialogTitle>
          <DialogDescription>
            Lengkapi informasi mata kuliah baru yang ingin Anda pelajari.
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
            <Label htmlFor="create-course-sem">Semester *</Label>
            <Select
              value={semesterId || undefined}
              onValueChange={(val) => setSemesterId(val)}
              disabled={isSubmitting || nonArchivedSemesters.length === 0}
            >
              <SelectTrigger id="create-course-sem" className="w-full">
                <SelectValue placeholder="Pilih semester" />
              </SelectTrigger>
              <SelectContent>
                {nonArchivedSemesters.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.academicYear}){s.isActive ? ' — Aktif' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {nonArchivedSemesters.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Belum ada semester aktif. Buat semester terlebih dahulu di menu Semester.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-course-name">Nama Mata Kuliah *</Label>
            <Input
              id="create-course-name"
              placeholder="Contoh: Algoritma & Pemrograman"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="create-course-code">Kode (Opsional)</Label>
              <Input
                id="create-course-code"
                placeholder="Contoh: IF210"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-course-lecturer">Dosen (Opsional)</Label>
              <Input
                id="create-course-lecturer"
                placeholder="Contoh: Dr. Budi"
                value={lecturer}
                onChange={(e) => setLecturer(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-course-desc">Deskripsi (Opsional)</Label>
            <Textarea
              id="create-course-desc"
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
                  Menyimpan...
                </>
              ) : (
                'Simpan Mata Kuliah'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
