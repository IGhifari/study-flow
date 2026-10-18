'use client';

import * as React from 'react';
import {
  Loader2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export interface MaterialEditTitleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTitle: string;
  onEditTitleChange: (title: string) => void;
  isSubmitting: boolean;
  editError: string | null;
  onSubmit: (e: React.FormEvent) => void;
}

export function MaterialEditTitleDialog({
  open,
  onOpenChange,
  editTitle,
  onEditTitleChange,
  isSubmitting,
  editError,
  onSubmit,
}: MaterialEditTitleDialogProps): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] p-5 sm:p-6">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Edit Judul Materi
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
              Perbarui judul dokumen materi perkuliahan ini.
            </DialogDescription>
          </DialogHeader>

          {editError && (
            <div
              role="alert"
              className="mt-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{editError}</span>
            </div>
          )}

          <div className="mt-4 space-y-1.5">
            <Label htmlFor="edit-title" className="text-xs font-semibold text-foreground">
              Judul Dokumen *
            </Label>
            <Input
              id="edit-title"
              value={editTitle}
              onChange={(e) => onEditTitleChange(e.target.value)}
              disabled={isSubmitting}
              required
              className="h-9 text-xs sm:text-sm"
            />
          </div>

          <DialogFooter className="mt-5 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
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
              disabled={isSubmitting || !editTitle.trim()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Menyimpan...
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

export interface MaterialDeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  materialTitle: string;
  isSubmitting: boolean;
  deleteError: string | null;
  onConfirmDelete: () => void;
}

export function MaterialDeleteConfirmDialog({
  open,
  onOpenChange,
  materialTitle,
  isSubmitting,
  deleteError,
  onConfirmDelete,
}: MaterialDeleteConfirmDialogProps): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-foreground">
            Hapus Materi Kuliah?
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1.5">
            Materi <span className="font-semibold text-foreground">&ldquo;{materialTitle}&rdquo;</span>{' '}
            beserta seluruh berkas, ringkasan AI, flashcard, dan kuis terkait akan dihapus permanen. Catatan manual tetap disimpan.
          </DialogDescription>
        </DialogHeader>

        {deleteError && (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive font-medium"
          >
            {deleteError}
          </div>
        )}

        <DialogFooter className="mt-5 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
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
            type="button"
            variant="destructive"
            size="standard"
            onClick={onConfirmDelete}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Menghapus...
              </>
            ) : (
              'Hapus Materi'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface MaterialRegenerateSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dailyRemainingQuota: number;
  isGenerating: boolean;
  onConfirmRegenerate: () => void;
}

export function MaterialRegenerateSummaryDialog({
  open,
  onOpenChange,
  dailyRemainingQuota,
  isGenerating,
  onConfirmRegenerate,
}: MaterialRegenerateSummaryDialogProps): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-foreground">
            Regenerasi Ringkasan AI
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1.5">
            Apakah kamu ingin membuat ulang ringkasan ini? Tindakan ini akan memakai 1 kuota harian ({dailyRemainingQuota} tersisa). Ringkasan saat ini tetap disimpan sampai proses selesai.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-5 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="standard"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
          >
            Batal
          </Button>
          <Button
            type="button"
            size="standard"
            onClick={onConfirmRegenerate}
            disabled={isGenerating}
            className="gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Ya, Regenerasi</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
