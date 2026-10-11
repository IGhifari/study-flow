'use client';

import * as React from 'react';
import {
  Layers,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  CheckCircle,
  HelpCircle,
  FileText,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { FlashcardSet, Flashcard } from '@studyflow/shared';
import {
  getMaterialFlashcards,
  generateFlashcards,
  updateFlashcardMastery,
} from '@/lib/learning-client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface MaterialFlashcardTabProps {
  materialId: string;
  isArchived?: boolean;
  onNavigateToPage?: (pageNumber: number) => void;
}

export function MaterialFlashcardTab({
  materialId,
  isArchived = false,
  onNavigateToPage,
}: MaterialFlashcardTabProps): React.JSX.Element {
  const [sets, setSets] = React.useState<FlashcardSet[]>([]);
  const [selectedSet, setSelectedSet] = React.useState<FlashcardSet | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Dialog pembuatan flashcard baru
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = React.useState(false);
  const [targetCount, setTargetCount] = React.useState<5 | 10 | 20>(10);
  const [isSubmittingGen, setIsSubmittingGen] = React.useState(false);

  // Status pembelajaran kartu saat ini
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isFlipped, setIsFlipped] = React.useState(false);
  const [isUpdatingMastery, setIsUpdatingMastery] = React.useState(false);
  const [masteryError, setMasteryError] = React.useState<string | null>(null);

  const loadSets = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await getMaterialFlashcards(materialId);
      setSets(res.sets);
      if (res.sets.length > 0) {
        setSelectedSet((prev) => {
          if (!prev) return res.sets[0];
          const matched = res.sets.find((s) => s.id === prev.id);
          return matched || res.sets[0];
        });
      }
    } catch (err: any) {
      console.error('Failed to load flashcard sets:', err);
      // Jangan hilangkan set yang sudah ada jika refresh sementara gagal
      setErrorMessage(err.message || 'Gagal memuat flashcards');
    } finally {
      setIsLoading(false);
    }
  }, [materialId]);

  React.useEffect(() => {
    loadSets();
  }, [loadSets]);

  // Polling untuk status job AI background (QUEUED atau PROCESSING)
  React.useEffect(() => {
    const hasActiveJob = sets.some(
      (s) => s.status === 'QUEUED' || s.status === 'PROCESSING'
    );
    if (!hasActiveJob) return;

    const interval = setInterval(async () => {
      try {
        const res = await getMaterialFlashcards(materialId);
        setSets(res.sets);
        if (selectedSet) {
          const updated = res.sets.find((s) => s.id === selectedSet.id);
          if (updated) setSelectedSet(updated);
        }
      } catch (err) {
        console.error('Flashcard polling error:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [sets, materialId, selectedSet]);

  const handleRequestGeneration = async () => {
    setIsSubmittingGen(true);
    setErrorMessage(null);
    try {
      await generateFlashcards(materialId, targetCount);
      setIsGenerateDialogOpen(false);
      await loadSets();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal meminta pembuatan flashcards');
    } finally {
      setIsSubmittingGen(false);
    }
  };

  const handleUpdateMastery = async (cardId: string, status: 'NEED_REVIEW' | 'MASTERED') => {
    if (!selectedSet || !selectedSet.cards) return;
    setIsUpdatingMastery(true);
    setMasteryError(null);
    try {
      const updatedCard = await updateFlashcardMastery(cardId, status);
      setSelectedSet((prev) => {
        if (!prev || !prev.cards) return prev;
        return {
          ...prev,
          cards: prev.cards.map((c) => (c.id === cardId ? updatedCard : c)),
        };
      });
      // Pindah ke kartu berikutnya secara otomatis jika belum di ujung
      if (currentIndex < selectedSet.cards.length - 1) {
        setCurrentIndex((i) => i + 1);
        setIsFlipped(false);
      }
    } catch (err: any) {
      setMasteryError(err.message || 'Gagal memperbarui status pemahaman');
    } finally {
      setIsUpdatingMastery(false);
    }
  };

  const cards: Flashcard[] = selectedSet?.cards || [];
  const currentCard: Flashcard | undefined = cards[currentIndex];

  const masteredCount = cards.filter((c) => c.masteryStatus === 'MASTERED').length;
  const reviewCount = cards.filter((c) => c.masteryStatus === 'NEED_REVIEW').length;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-3 text-sm font-medium">Memuat flashcard materi...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar Flashcards */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">Flashcards Materi</h2>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Latih pemahaman konsep dan istilah kunci materi kuliah dengan kartu belajar interaktif.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {sets.length > 0 && (
            <select
              value={selectedSet?.id || ''}
              onChange={(e) => {
                const found = sets.find((s) => s.id === e.target.value);
                if (found) {
                  setSelectedSet(found);
                  setCurrentIndex(0);
                  setIsFlipped(false);
                }
              }}
              className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary"
              aria-label="Pilih set flashcard"
            >
              {sets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} ({s.cards?.length || s.cardCount} kartu)
                </option>
              ))}
            </select>
          )}

          <Button
            size="standard"
            onClick={() => setIsGenerateDialogOpen(true)}
            disabled={isArchived}
            className="gap-1.5 text-xs h-9"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Buat Flashcard Baru</span>
          </Button>
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Case 1: Belum Ada Flashcard (Empty Onboarding) */}
      {sets.length === 0 ? (
        <Card className="p-10 sm:p-14 text-center bg-card border-dashed border-border shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Layers className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">Belum Ada Flashcard</h3>
          <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Hasilkan set flashcard dari materi kuliah ini dengan bantuan AI untuk melatih daya ingat dan pemahaman konsep secara terarah.
          </p>
          <Button
            size="standard"
            onClick={() => setIsGenerateDialogOpen(true)}
            disabled={isArchived}
            className="mt-5 gap-2 text-xs"
          >
            <Sparkles className="h-4 w-4" />
            <span>Buat Flashcard Sekarang</span>
          </Button>
        </Card>
      ) : selectedSet?.status === 'QUEUED' || selectedSet?.status === 'PROCESSING' ? (
        /* Case 2: Dalam Proses Generasi AI */
        <Card className="p-10 sm:p-14 text-center bg-card border border-border shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">Menyusun Flashcard AI...</h3>
          <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            AI sedang menganalisis teks materi dan merancang pasangan pertanyaan serta jawaban lengkap dengan rujukan halaman dokumen PDF.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3.5 py-1 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span>Memproses di antrean background worker</span>
          </div>
        </Card>
      ) : selectedSet?.status === 'FAILED' ? (
        /* Case 3: Gagal Generasi AI */
        <Card className="border border-destructive/30 bg-destructive/5 p-8 sm:p-10 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-base font-semibold text-destructive">Gagal Membuat Flashcard</h3>
          <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            {selectedSet.errorMessage || 'Terjadi kendala saat menganalisis berkas materi dengan AI.'}
          </p>
          <Button
            size="standard"
            variant="outline"
            onClick={() => setIsGenerateDialogOpen(true)}
            className="mt-5 gap-1.5 text-xs"
          >
            <RotateCw className="h-3.5 w-3.5" />
            <span>Coba Buat Ulang</span>
          </Button>
        </Card>
      ) : cards.length > 0 && currentCard ? (
        /* Case 4: Flashcard Study Player */
        <div className="space-y-4 max-w-2xl mx-auto">
          {/* Bar Info & Statistik Progres */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground px-1">
            <div className="flex items-center gap-2.5">
              <span className="font-semibold text-foreground">
                Kartu {currentIndex + 1} dari {cards.length}
              </span>
              <span>•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                {masteredCount} Paham
              </span>
              <span>•</span>
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                {reviewCount} Perlu Diulang
              </span>
            </div>

            {currentCard.pageReferences && currentCard.pageReferences.length > 0 && onNavigateToPage && (
              <button
                type="button"
                onClick={() => onNavigateToPage(currentCard.pageReferences[0])}
                className="hover:text-primary transition-colors flex items-center gap-1 underline underline-offset-2 text-xs text-primary font-medium"
                title={`Buka halaman ${currentCard.pageReferences.join(', ')} di pembaca PDF`}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Lihat Hal. {currentCard.pageReferences.join(', ')}</span>
              </button>
            )}
          </div>

          {/* Kartu Belajar Interaktif */}
          <div
            role="region"
            aria-label={`Kartu belajar ${currentIndex + 1} dari ${cards.length}`}
            onClick={() => setIsFlipped(!isFlipped)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                setIsFlipped(!isFlipped);
              }
            }}
            className={`min-h-[260px] sm:min-h-[300px] w-full rounded-xl border p-6 sm:p-8 flex flex-col justify-between cursor-pointer select-none transition-colors duration-150 motion-reduce:transition-none shadow-xs ${
              isFlipped
                ? 'border-primary/40 bg-primary/5 hover:border-primary/60 dark:bg-primary/10'
                : 'border-border bg-card hover:border-muted-foreground/30'
            }`}
          >
            {/* Header Sisi Kartu */}
            <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <span>{isFlipped ? 'Jawaban / Penjelasan' : 'Pertanyaan / Istilah'}</span>
              <span className="flex items-center gap-1.5 normal-case font-normal text-muted-foreground">
                <RotateCw className="h-3 w-3" />
                <span>Klik untuk membalik</span>
              </span>
            </div>

            {/* Isi Teks Utama (Jawaban Panjang Terbaca Tuntas) */}
            <div className="my-auto py-5 max-h-[360px] overflow-y-auto px-1">
              <p className="text-base sm:text-lg font-semibold text-foreground text-center leading-relaxed whitespace-pre-wrap break-words">
                {isFlipped ? currentCard.back : currentCard.front}
              </p>
            </div>

            {/* Footer Sisi Kartu */}
            <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/40 pt-3">
              <div>
                {currentCard.masteryStatus === 'MASTERED' ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium text-xs">
                    <CheckCircle className="h-3.5 w-3.5" /> Sudah paham
                  </span>
                ) : currentCard.masteryStatus === 'NEED_REVIEW' ? (
                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium text-xs">
                    <HelpCircle className="h-3.5 w-3.5" /> Perlu diulang
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs">Belum ditandai</span>
                )}
              </div>

              <span className="text-[11px] hidden sm:inline">Tekan Spasi atau klik kartu</span>
            </div>
          </div>

          {/* Tombol Balik Kartu Eksplisit */}
          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              size="standard"
              onClick={() => setIsFlipped(!isFlipped)}
              className="gap-2 text-xs min-h-[44px] sm:min-h-[36px] w-full sm:w-auto"
            >
              {isFlipped ? (
                <>
                  <EyeOff className="h-4 w-4" />
                  <span>Sembunyikan Jawaban</span>
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  <span>Tampilkan Jawaban</span>
                </>
              )}
            </Button>
          </div>

          {masteryError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{masteryError}</span>
            </div>
          )}

          {/* Tombol Penilaian Pemahaman Pribadi */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <Button
              variant="outline"
              size="standard"
              onClick={() => handleUpdateMastery(currentCard.id, 'NEED_REVIEW')}
              disabled={isUpdatingMastery || isArchived}
              className="flex-1 gap-1.5 text-xs text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 min-h-[44px] sm:min-h-[36px]"
            >
              <HelpCircle className="h-4 w-4" />
              <span>Perlu Diulang</span>
            </Button>

            <Button
              variant="outline"
              size="standard"
              onClick={() => handleUpdateMastery(currentCard.id, 'MASTERED')}
              disabled={isUpdatingMastery || isArchived}
              className="flex-1 gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 min-h-[44px] sm:min-h-[36px]"
            >
              <CheckCircle className="h-4 w-4" />
              <span>Sudah Paham</span>
            </Button>
          </div>

          {/* Navigasi Stepper Sebelumnya & Selanjutnya */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Button
              variant="ghost"
              size="standard"
              onClick={() => {
                if (currentIndex > 0) {
                  setCurrentIndex((i) => i - 1);
                  setIsFlipped(false);
                }
              }}
              disabled={currentIndex === 0}
              className="gap-1.5 text-xs min-h-[44px] sm:min-h-[36px]"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Sebelumnya</span>
            </Button>

            <span className="text-xs font-semibold text-foreground">
              {currentIndex + 1} / {cards.length}
            </span>

            <Button
              variant="ghost"
              size="standard"
              onClick={() => {
                if (currentIndex < cards.length - 1) {
                  setCurrentIndex((i) => i + 1);
                  setIsFlipped(false);
                }
              }}
              disabled={currentIndex === cards.length - 1}
              className="gap-1.5 text-xs min-h-[44px] sm:min-h-[36px]"
            >
              <span>Selanjutnya</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {/* Dialog Konfigurasi Pembuatan Flashcard AI */}
      <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
        <DialogContent className="sm:max-w-[420px] p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Buat Flashcard dengan AI
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
              Pilih jumlah kartu yang ingin dibuat dari materi perkuliahan ini.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <label className="text-xs font-semibold text-foreground">Jumlah Kartu Belajar</label>
            <div className="grid grid-cols-3 gap-3">
              {[5, 10, 20].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setTargetCount(count as 5 | 10 | 20)}
                  className={`rounded-xl border p-3.5 text-center transition-all cursor-pointer ${
                    targetCount === count
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                      : 'border-border bg-card text-foreground hover:bg-muted/40'
                  }`}
                >
                  <span className="text-base sm:text-lg">{count}</span>
                  <span className="block text-[11px] font-normal text-muted-foreground mt-0.5">
                    Kartu
                  </span>
                </button>
              ))}
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
              Pembuatan flashcard menggunakan kuota AI harian Anda. Kartu dilengkapi rujukan halaman PDF asli untuk memverifikasi materi.
            </p>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="standard"
              onClick={() => setIsGenerateDialogOpen(false)}
              disabled={isSubmittingGen}
            >
              Batal
            </Button>
            <Button
              size="standard"
              onClick={handleRequestGeneration}
              disabled={isSubmittingGen}
              className="gap-2"
            >
              {isSubmittingGen ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Mulai Pembuatan</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
