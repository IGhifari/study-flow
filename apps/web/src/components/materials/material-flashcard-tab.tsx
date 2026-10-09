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
  Plus,
} from 'lucide-react';
import { FlashcardSet, Flashcard } from '@studyflow/shared';
import {
  getMaterialFlashcards,
  generateFlashcards,
  updateFlashcardMastery,
  LearningApiError,
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

  // Generation dialog
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = React.useState(false);
  const [targetCount, setTargetCount] = React.useState<5 | 10 | 20>(10);
  const [isSubmittingGen, setIsSubmittingGen] = React.useState(false);

  // Study Deck State
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
        // Default to first set or keep currently selected set
        setSelectedSet((prev) => {
          if (!prev) return res.sets[0];
          const matched = res.sets.find((s) => s.id === prev.id);
          return matched || res.sets[0];
        });
      }
    } catch (err: any) {
      console.error('Failed to load flashcard sets:', err);
      setErrorMessage(err.message || 'Gagal memuat flashcards');
    } finally {
      setIsLoading(false);
    }
  }, [materialId]);

  React.useEffect(() => {
    loadSets();
  }, [loadSets]);

  // Polling for QUEUED or PROCESSING set
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
      // Automatically advance to next card if not at end
      if (currentIndex < (selectedSet.cards.length - 1)) {
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
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-3 text-sm">Memuat flashcards materi...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Set Selector / Action */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">Flashcards Materi</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Latih pemahaman konsep penting materi dengan kartu belajar interaktif.
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
              className="h-8 rounded-md border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {sets.map((s, idx) => (
                <option key={s.id} value={s.id}>
                  {s.title} ({s.cards?.length || s.cardCount} kartu)
                </option>
              ))}
            </select>
          )}

          <Button
            size="sm"
            onClick={() => setIsGenerateDialogOpen(true)}
            disabled={isArchived}
            className="gap-1.5 text-xs h-8"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span>Buat Flashcard Baru</span>
          </Button>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3 text-xs text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Case 1: Empty state (No sets generated yet) */}
      {sets.length === 0 ? (
        <Card className="p-12 text-center bg-card">
          <Layers className="h-10 w-10 text-muted-foreground mx-auto" />
          <h3 className="mt-3 text-base font-semibold text-foreground">Belum Ada Flashcard</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
            Hasilkan set flashcard berbasis materi ini dengan bantuan AI untuk membantu mengingat poin-poin penting.
          </p>
          <Button
            size="sm"
            onClick={() => setIsGenerateDialogOpen(true)}
            disabled={isArchived}
            className="mt-4 gap-2"
          >
            <Sparkles className="h-4 w-4 text-amber-300" />
            <span>Buat Flashcard Sekarang</span>
          </Button>
        </Card>
      ) : selectedSet?.status === 'QUEUED' || selectedSet?.status === 'PROCESSING' ? (
        /* Case 2: In-Progress Generation */
        <Card className="p-12 text-center bg-card">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <h3 className="mt-4 text-base font-semibold text-foreground">Menyusun Flashcard AI...</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
            AI sedang menganalisis konsep dan istilah penting dari materi untuk dijadikan pasangan pertanyaan-jawaban.
          </p>
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground font-medium">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span>Memproses di background worker</span>
          </div>
        </Card>
      ) : selectedSet?.status === 'FAILED' ? (
        /* Case 3: Failed Generation */
        <Card className="border-danger/30 bg-danger/5 p-8 text-center">
          <AlertCircle className="h-8 w-8 text-danger mx-auto" />
          <h3 className="mt-2 text-base font-semibold text-danger">Gagal Membuat Flashcard</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
            {selectedSet.errorMessage || 'Terjadi kesalahan saat memproses materi dengan AI.'}
          </p>
          <Button
            size="sm"
            onClick={() => setIsGenerateDialogOpen(true)}
            className="mt-4 gap-1.5"
          >
            <RotateCw className="h-3.5 w-3.5" />
            <span>Coba Buat Ulang</span>
          </Button>
        </Card>
      ) : cards.length > 0 && currentCard ? (
        /* Case 4: Flashcard Study Player */
        <div className="space-y-4 max-w-2xl mx-auto">
          {/* Progress and Stats bar */}
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <div className="flex items-center gap-3">
              <span className="font-medium text-foreground">
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
                className="hover:text-primary transition-colors flex items-center gap-1 underline underline-offset-2 text-[11px]"
              >
                <FileText className="h-3 w-3" />
                <span>Lihat Hal. {currentCard.pageReferences.join(', ')}</span>
              </button>
            )}
          </div>

          {/* Flashcard Flip Deck */}
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                setIsFlipped(!isFlipped);
              }
            }}
            className={`min-h-[260px] sm:min-h-[300px] w-full rounded-xl border p-8 flex flex-col justify-between cursor-pointer select-none transition-all duration-200 shadow-sm ${
              isFlipped
                ? 'border-primary/40 bg-primary/5 hover:border-primary/60'
                : 'border-border bg-card hover:border-muted-foreground/40'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              <span>{isFlipped ? 'Jawaban / Penjelasan' : 'Pertanyaan / Istilah'}</span>
              <span className="flex items-center gap-1 text-[11px] normal-case text-muted-foreground">
                <RotateCw className="h-3 w-3" />
                <span>Klik untuk membalik</span>
              </span>
            </div>

            <div className="my-auto py-6 text-center">
              <p className="text-base sm:text-lg font-semibold text-foreground leading-relaxed whitespace-pre-wrap">
                {isFlipped ? currentCard.back : currentCard.front}
              </p>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <div>
                {currentCard.masteryStatus === 'MASTERED' ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle className="h-3.5 w-3.5" /> Sudah paham
                  </span>
                ) : currentCard.masteryStatus === 'NEED_REVIEW' ? (
                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                    <HelpCircle className="h-3.5 w-3.5" /> Perlu diulang
                  </span>
                ) : (
                  <span className="text-muted-foreground">Belum ditandai</span>
                )}
              </div>

              <span>Gunakan Spasi / Klik untuk membalik</span>
            </div>
          </div>

          {masteryError && (
            <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 p-2.5 text-xs text-danger">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{masteryError}</span>
            </div>
          )}

          {/* Mastery Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleUpdateMastery(currentCard.id, 'NEED_REVIEW')}
              disabled={isUpdatingMastery || isArchived}
              className="flex-1 gap-1.5 text-xs text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Perlu Diulang</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleUpdateMastery(currentCard.id, 'MASTERED')}
              disabled={isUpdatingMastery || isArchived}
              className="flex-1 gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              <span>Sudah Paham</span>
            </Button>
          </div>

          {/* Pagination Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (currentIndex > 0) {
                  setCurrentIndex((i) => i - 1);
                  setIsFlipped(false);
                }
              }}
              disabled={currentIndex === 0}
              className="gap-1 text-xs"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Sebelumnya</span>
            </Button>

            <span className="text-xs text-muted-foreground">
              {currentIndex + 1} / {cards.length}
            </span>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (currentIndex < cards.length - 1) {
                  setCurrentIndex((i) => i + 1);
                  setIsFlipped(false);
                }
              }}
              disabled={currentIndex === cards.length - 1}
              className="gap-1 text-xs"
            >
              <span>Selanjutnya</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {/* Generation Setup Dialog */}
      <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buat Flashcard dengan AI</DialogTitle>
            <DialogDescription>
              Pilih jumlah kartu yang ingin dibuat dari materi perkuliahan ini.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <label className="text-xs font-semibold text-foreground">Jumlah Kartu</label>
            <div className="grid grid-cols-3 gap-3">
              {[5, 10, 20].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setTargetCount(count as 5 | 10 | 20)}
                  className={`rounded-lg border p-4 text-center transition-all ${
                    targetCount === count
                      ? 'border-primary bg-primary/10 text-primary font-bold'
                      : 'border-border bg-card text-foreground hover:bg-muted/50'
                  }`}
                >
                  <span className="text-lg">{count}</span>
                  <span className="block text-[11px] font-normal text-muted-foreground mt-0.5">
                    Kartu
                  </span>
                </button>
              ))}
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Membuat flashcard menggunakan kuota AI harian Anda. Kartu dibuat secara otomatis dengan rujukan halaman dokumen PDF.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsGenerateDialogOpen(false)}
              disabled={isSubmittingGen}
            >
              Batal
            </Button>
            <Button
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
                  <Sparkles className="h-4 w-4 text-amber-300" />
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
