'use client';

import * as React from 'react';
import {
  Upload,
  FileText,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { Course, FILE_UPLOAD_LIMITS } from '@studyflow/shared';
import { initiateUpload, finalizeUpload } from '@/lib/material-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  RadixSelect as Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface MaterialUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: Course[];
  initialCourseId?: string;
  onSuccess: (materialId: string, jobId: string) => void;
}

type UploadStep = 'IDLE' | 'TRANSFERRING' | 'FINALIZING' | 'SUCCESS' | 'ERROR';

export function MaterialUploadDialog({
  open,
  onOpenChange,
  courses,
  initialCourseId,
  onSuccess,
}: MaterialUploadDialogProps): React.JSX.Element {
  const [courseId, setCourseId] = React.useState(initialCourseId || '');
  const [title, setTitle] = React.useState('');
  const [file, setFile] = React.useState<File | null>(null);
  const [step, setStep] = React.useState<UploadStep>('IDLE');
  const [transferPercent, setTransferPercent] = React.useState<number | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Sync initialCourseId if prop changes
  React.useEffect(() => {
    if (initialCourseId) {
      setCourseId(initialCourseId);
    } else if (courses.length > 0 && !courseId) {
      setCourseId(courses[0]!.id);
    }
  }, [initialCourseId, courses, courseId]);

  const resetForm = () => {
    setFile(null);
    setTitle('');
    setStep('IDLE');
    setTransferPercent(null);
    setErrorMessage(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.type !== 'application/pdf' && !selected.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Hanya format PDF berbasis teks yang didukung.');
      setFile(null);
      return;
    }

    if (selected.size > FILE_UPLOAD_LIMITS.maxSizeBytes) {
      setErrorMessage(
        `Ukuran file (${(selected.size / (1024 * 1024)).toFixed(1)} MB) melebihi batas maksimal 20 MB.`
      );
      setFile(null);
      return;
    }

    setFile(selected);
    setErrorMessage(null);

    // Auto-fill title from filename without extension if empty
    if (!title.trim()) {
      const nameWithoutExt = selected.name.replace(/\.[^/.]+$/, '');
      setTitle(nameWithoutExt);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const droppedFile = e.dataTransfer.files?.[0];
    if (!droppedFile) return;

    if (droppedFile.type !== 'application/pdf' && !droppedFile.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Hanya format PDF berbasis teks yang didukung.');
      setFile(null);
      return;
    }

    if (droppedFile.size > FILE_UPLOAD_LIMITS.maxSizeBytes) {
      setErrorMessage(
        `Ukuran file (${(droppedFile.size / (1024 * 1024)).toFixed(1)} MB) melebihi batas maksimal 20 MB.`
      );
      setFile(null);
      return;
    }

    setFile(droppedFile);
    setErrorMessage(null);

    if (!title.trim()) {
      const nameWithoutExt = droppedFile.name.replace(/\.[^/.]+$/, '');
      setTitle(nameWithoutExt);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) {
      setErrorMessage('Pilih mata kuliah terlebih dahulu.');
      return;
    }
    if (!title.trim()) {
      setErrorMessage('Judul materi wajib diisi.');
      return;
    }
    if (!file) {
      setErrorMessage('Pilih file PDF yang akan diunggah.');
      return;
    }

    setErrorMessage(null);
    setStep('TRANSFERRING');
    setTransferPercent(0);

    try {
      // 1. Inisiasi Upload via BFF -> Express API
      const initRes = await initiateUpload({
        courseId,
        title: title.trim(),
        filename: file.name,
        fileSize: file.size,
        mimeType: 'application/pdf',
      });

      // 2. Unggah file langsung ke Storage (Supabase Storage upload URL atau mock endpoint)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', initRes.uploadUrl, true);
        xhr.setRequestHeader('Content-Type', 'application/pdf');

        if (initRes.signedUploadToken) {
          xhr.setRequestHeader('Authorization', `Bearer ${initRes.signedUploadToken}`);
        }

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setTransferPercent(percent);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Gagal mentransfer file ke storage (HTTP ${xhr.status})`));
          }
        };

        xhr.onerror = () => {
          reject(new Error('Koneksi jaringan terputus saat mentransfer file.'));
        };

        xhr.send(file);
      });

      // 3. Finalisasi Upload via API
      setStep('FINALIZING');
      setTransferPercent(null);

      const finalizeRes = await finalizeUpload(initRes.materialId);

      setStep('SUCCESS');
      onSuccess(finalizeRes.material.id, finalizeRes.jobId);

      setTimeout(() => {
        resetForm();
        onOpenChange(false);
      }, 1200);
    } catch (err: any) {
      setStep('ERROR');
      setErrorMessage(
        err.message || 'Terjadi kesalahan saat mengunggah materi. Silakan coba kembali.'
      );
    }
  };

  const isUploading = step === 'TRANSFERRING' || step === 'FINALIZING';
  const selectedCourse = courses.find((c) => c.id === courseId);

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!isUploading) {
          if (!val) resetForm();
          onOpenChange(val);
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:max-w-[520px] p-5 sm:p-6">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">
              Unggah Materi PDF
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
              PDF berbasis teks, maksimal 20 MB dan 100 halaman. PDF hasil scan belum didukung.
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs leading-relaxed">
                {errorMessage}
              </AlertDescription>
            </Alert>
          )}

          <div className="mt-4 space-y-4">
            {/* Pilihan Mata Kuliah */}
            <div className="space-y-1.5">
              <Label htmlFor="upload-course" className="text-xs font-semibold text-foreground">
                Mata Kuliah *
              </Label>
              <Select
                value={courseId}
                onValueChange={(val) => setCourseId(val)}
                disabled={isUploading || Boolean(initialCourseId)}
              >
                <SelectTrigger id="upload-course" className="h-10 text-xs sm:text-sm w-full">
                  <SelectValue placeholder="Pilih mata kuliah..." />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.code ? `(${c.code})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Judul Materi */}
            <div className="space-y-1.5">
              <Label htmlFor="upload-title" className="text-xs font-semibold text-foreground">
                Judul Materi *
              </Label>
              <Input
                id="upload-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Bab 1 - Pengantar Basis Data"
                disabled={isUploading}
                required
                className="h-10 text-xs sm:text-sm"
              />
            </div>

            {/* Dropzone File */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Berkas PDF *
              </Label>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
                  file
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border hover:border-primary/40 bg-muted/20'
                } ${isUploading ? 'pointer-events-none opacity-60' : ''}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isUploading}
                />

                {file ? (
                  <div className="flex flex-col items-center gap-2 w-full">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="text-center w-full min-w-0 px-2">
                      <p className="text-sm font-semibold text-foreground truncate" title={file.name}>
                        {file.name}
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                        <span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                        {selectedCourse && (
                          <>
                            <span>•</span>
                            <span className="text-foreground/80 font-medium truncate max-w-[200px]">
                              {selectedCourse.name}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => !isUploading && fileInputRef.current?.click()}
                      className="mt-1 h-8 gap-1.5 text-xs"
                      disabled={isUploading}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>Ganti berkas PDF</span>
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        Tarik & lepas berkas PDF ke sini, atau klik untuk memilih
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Maksimal 20 MB dan 100 halaman (PDF berbasis teks)
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => !isUploading && fileInputRef.current?.click()}
                      className="h-8 gap-1.5 text-xs"
                      disabled={isUploading}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>Pilih Berkas PDF</span>
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Progres Transfer / Finalisasi */}
            {step === 'TRANSFERRING' && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
                <div className="flex justify-between text-xs font-medium text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    <span>Mengunggah berkas ke penyimpanan...</span>
                  </span>
                  <span>{transferPercent !== null ? `${transferPercent}%` : ''}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-200"
                    style={{ width: `${Math.max(transferPercent ?? 10, 5)}%` }}
                  />
                </div>
              </div>
            )}

            {step === 'FINALIZING' && (
              <div className="flex items-center gap-2 rounded-lg bg-primary/10 p-3 text-xs font-medium text-primary">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                <span>Memverifikasi berkas di penyimpanan dan menyiapkan antrean...</span>
              </div>
            )}

            {step === 'SUCCESS' && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>File berhasil diterima! Menjadwalkan ekstraksi dokumen...</span>
              </div>
            )}

            <p className="text-xs text-muted-foreground leading-relaxed">
              Setelah upload selesai, kamu boleh meninggalkan halaman. Pemrosesan ekstraksi tetap
              berjalan di antrean sistem.
            </p>
          </div>

          <DialogFooter className="mt-6 flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="standard"
              onClick={() => onOpenChange(false)}
              disabled={isUploading}
              className="min-h-[44px] sm:min-h-[36px]"
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="standard"
              disabled={isUploading || !file || !title.trim() || !courseId}
              className="min-h-[44px] sm:min-h-[36px]"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Mengunggah...
                </>
              ) : (
                'Unggah Materi'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
