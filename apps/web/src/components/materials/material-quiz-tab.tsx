'use client';

import * as React from 'react';
import {
  HelpCircle,
  Sparkles,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  FileText,
  AlertCircle,
  Loader2,
  Award,
  Check,
} from 'lucide-react';
import {
  Quiz,
  QuizAttemptResponse,
  StartQuizAttemptResponse,
} from '@studyflow/shared';
import {
  getMaterialQuizzes,
  generateQuiz,
  startQuizAttempt,
  saveQuizDraftAnswers,
  submitQuizAttempt,
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
import {
  RadixSelect as Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface MaterialQuizTabProps {
  materialId: string;
  isArchived?: boolean;
  onNavigateToPage?: (pageNumber: number) => void;
}

export function MaterialQuizTab({
  materialId,
  isArchived = false,
  onNavigateToPage,
}: MaterialQuizTabProps): React.JSX.Element {
  const [quizzes, setQuizzes] = React.useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = React.useState<Quiz | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Dialog konfigurasi pembuatan kuis baru
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = React.useState(false);
  const [targetCount, setTargetCount] = React.useState<5 | 10>(5);
  const [isSubmittingGen, setIsSubmittingGen] = React.useState(false);

  // Status pengerjaan kuis yang sedang aktif (Active Attempt)
  const [activeAttempt, setActiveAttempt] = React.useState<StartQuizAttemptResponse | null>(null);
  const [userAnswers, setUserAnswers] = React.useState<Record<string, number>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = React.useState(0);
  const [isStartingAttempt, setIsStartingAttempt] = React.useState(false);
  const [isSubmittingAttempt, setIsSubmittingAttempt] = React.useState(false);

  // Status penyimpanan draft jawaban (idle, saving, saved, error)
  const [draftSaveStatus, setDraftSaveStatus] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [draftSaveError, setDraftSaveError] = React.useState<string | null>(null);

  // Dialog konfirmasi submit kuis
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = React.useState(false);

  // Hasil pengerjaan kuis yang sudah dinilai (Completed Attempt Review)
  const [completedAttempt, setCompletedAttempt] = React.useState<QuizAttemptResponse | null>(null);

  const loadQuizzes = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await getMaterialQuizzes(materialId);
      setQuizzes(res.quizzes);
      if (res.quizzes.length > 0) {
        setSelectedQuiz((prev) => {
          if (!prev) return res.quizzes[0];
          const found = res.quizzes.find((q) => q.id === prev.id);
          return found || res.quizzes[0];
        });
      }
    } catch (err: any) {
      console.error('Failed to load quizzes:', err);
      // Jangan hapus daftar kuis yang sudah ada jika hanya terjadi kegagalan refresh sementara
      setErrorMessage(err.message || 'Gagal memuat kuis');
    } finally {
      setIsLoading(false);
    }
  }, [materialId]);

  React.useEffect(() => {
    loadQuizzes();
  }, [loadQuizzes]);

  // Polling untuk status job AI background (QUEUED atau PROCESSING)
  React.useEffect(() => {
    const hasActiveJob = quizzes.some(
      (q) => q.status === 'QUEUED' || q.status === 'PROCESSING'
    );
    if (!hasActiveJob) return;

    const interval = setInterval(async () => {
      try {
        const res = await getMaterialQuizzes(materialId);
        setQuizzes(res.quizzes);
        if (selectedQuiz) {
          const updated = res.quizzes.find((q) => q.id === selectedQuiz.id);
          if (updated) setSelectedQuiz(updated);
        }
      } catch (err) {
        console.error('Quiz polling error:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [quizzes, materialId, selectedQuiz]);

  const handleRequestGeneration = async () => {
    setIsSubmittingGen(true);
    setErrorMessage(null);
    try {
      await generateQuiz(materialId, targetCount);
      setIsGenerateDialogOpen(false);
      await loadQuizzes();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal meminta pembuatan kuis');
    } finally {
      setIsSubmittingGen(false);
    }
  };

  const handleStartAttempt = async (quizId: string) => {
    setIsStartingAttempt(true);
    setErrorMessage(null);
    setCompletedAttempt(null);
    try {
      const attemptRes = await startQuizAttempt(quizId);
      setActiveAttempt(attemptRes);
      // Restore jawaban yang sudah tersimpan sebelumnya jika ada
      setUserAnswers(attemptRes.existingAnswers || {});
      setCurrentQuestionIndex(0);
      setDraftSaveStatus(attemptRes.existingAnswers && Object.keys(attemptRes.existingAnswers).length > 0 ? 'saved' : 'idle');
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memulai kuis');
    } finally {
      setIsStartingAttempt(false);
    }
  };

  const persistDraftAnswer = async (attemptId: string, questionId: string, optionIndex: number) => {
    setDraftSaveStatus('saving');
    setDraftSaveError(null);
    try {
      await saveQuizDraftAnswers(attemptId, [
        { questionId, selectedIndex: optionIndex },
      ]);
      setDraftSaveStatus('saved');
    } catch (err: any) {
      console.error('Failed to save draft answer:', err);
      setDraftSaveStatus('error');
      setDraftSaveError(err.message || 'Gagal menyimpan draft jawaban ke server.');
    }
  };

  const handleSelectOption = (questionId: string, optionIndex: number) => {
    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex,
    }));

    if (activeAttempt) {
      persistDraftAnswer(activeAttempt.attemptId, questionId, optionIndex);
    }
  };

  const handleRetrySaveDraft = () => {
    if (!activeAttempt) return;
    const currentQId = activeAttempt.questions[currentQuestionIndex]?.id;
    if (currentQId && userAnswers[currentQId] !== undefined) {
      persistDraftAnswer(activeAttempt.attemptId, currentQId, userAnswers[currentQId]);
    }
  };

  const handleConfirmSubmit = async () => {
    if (!activeAttempt) return;
    setIsSubmittingAttempt(true);
    setErrorMessage(null);
    try {
      const formattedAnswers = activeAttempt.questions.map((q) => ({
        questionId: q.id,
        selectedIndex: userAnswers[q.id] !== undefined ? userAnswers[q.id] : null,
      }));

      const result = await submitQuizAttempt(activeAttempt.attemptId, formattedAnswers);
      setCompletedAttempt(result);
      setActiveAttempt(null);
      setIsSubmitConfirmOpen(false);
    } catch (err: any) {
      // Pertahankan seluruh jawaban pengguna saat submit gagal
      setErrorMessage(err.message || 'Gagal mengirimkan jawaban kuis. Silakan coba kirim ulang.');
    } finally {
      setIsSubmittingAttempt(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-3 text-sm font-medium">Memuat kuis materi...</p>
      </div>
    );
  }

  const answeredCount = Object.keys(userAnswers).length;
  const totalInAttempt = activeAttempt?.questions.length || 0;
  const unansweredCount = totalInAttempt - answeredCount;

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar Kuis */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">Kuis Pemahaman Materi</h2>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Uji kesiapan dan pemahaman konsep dengan soal pilihan ganda otomatis dan pembahasan berbasis rujukan dokumen PDF.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {quizzes.length > 0 && !activeAttempt && !completedAttempt && (
            <Select
              value={selectedQuiz?.id || ''}
              onValueChange={(val) => {
                const found = quizzes.find((q) => q.id === val);
                if (found) {
                  setSelectedQuiz(found);
                }
              }}
            >
              <SelectTrigger
                className="h-9 min-w-[200px] sm:min-w-[240px] text-xs font-medium"
                aria-label="Pilih set kuis"
              >
                <SelectValue placeholder="Pilih set kuis" />
              </SelectTrigger>
              <SelectContent>
                {quizzes.map((q) => (
                  <SelectItem key={q.id} value={q.id} className="text-xs">
                    {q.title} ({q.questionCount || q.targetCount} soal)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {!activeAttempt && (
            <Button
              size="standard"
              onClick={() => setIsGenerateDialogOpen(true)}
              disabled={isArchived}
              className="gap-1.5 text-xs h-9"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Buat Kuis Baru</span>
            </Button>
          )}
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

      {/* Case 1: Belum Ada Kuis (Empty State) */}
      {quizzes.length === 0 ? (
        <Card className="p-10 sm:p-14 text-center bg-card border-dashed border-border shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <HelpCircle className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">Belum Ada Kuis</h3>
          <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Hasilkan kuis pilihan ganda dari isi materi perkuliahan untuk menguji pemahaman konsep dan kesiapan ujian secara mandiri.
          </p>
          <Button
            size="standard"
            onClick={() => setIsGenerateDialogOpen(true)}
            disabled={isArchived}
            className="mt-5 gap-2 text-xs"
          >
            <Sparkles className="h-4 w-4" />
            <span>Buat Kuis Sekarang</span>
          </Button>
        </Card>
      ) : selectedQuiz?.status === 'QUEUED' || selectedQuiz?.status === 'PROCESSING' ? (
        /* Case 2: Dalam Proses Generasi AI */
        <Card className="p-10 sm:p-14 text-center bg-card border border-border shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">Menyusun Soal Kuis AI...</h3>
          <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            AI sedang menganalisis isi materi perkuliahan dan merancang soal pilihan ganda yang mendalam lengkap dengan rujukan pembahasan.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3.5 py-1 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span>Merancang soal kuis...</span>
          </div>
        </Card>
      ) : completedAttempt ? (
        /* Case 3: Hasil Kuis & Review Pembahasan */
        <div className="space-y-6 max-w-2xl mx-auto">
          {/* Banner Nilai & Hasil */}
          <Card className="p-6 sm:p-8 text-center border-border bg-card shadow-xs">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Award className="h-6 w-6" />
            </div>
            <h3 className="mt-3 text-lg font-bold text-foreground">Hasil Pengerjaan Kuis</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Evaluasi jawaban dihitung otomatis oleh sistem pada server.
            </p>

            <div className="mt-5 flex items-center justify-center gap-8 py-3 px-6 rounded-xl bg-muted/30 border border-border w-fit mx-auto">
              <div>
                <span className="text-3xl font-extrabold text-primary tabular-nums">
                  {completedAttempt.score}
                </span>
                <span className="block text-xs font-medium text-muted-foreground mt-0.5">
                  Nilai (0-100)
                </span>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <span className="text-2xl font-bold text-foreground tabular-nums">
                  {completedAttempt.correctAnswersCount} / {completedAttempt.totalQuestions}
                </span>
                <span className="block text-xs font-medium text-muted-foreground mt-0.5">
                  Jawaban Benar
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button
                size="standard"
                variant="outline"
                onClick={() => {
                  setCompletedAttempt(null);
                  if (selectedQuiz) handleStartAttempt(selectedQuiz.id);
                }}
                disabled={isArchived}
                className="gap-2 text-xs min-h-[44px] sm:min-h-[36px]"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Ulangi Kuis</span>
              </Button>
              <Button
                size="standard"
                variant="ghost"
                onClick={() => setCompletedAttempt(null)}
                className="text-xs min-h-[44px] sm:min-h-[36px]"
              >
                Kembali ke Beranda Kuis
              </Button>
            </div>
          </Card>

          {/* Daftar Review Pembahasan & Referensi */}
          <div className="space-y-4">
            <div className="border-b border-border pb-2">
              <h4 className="text-sm font-bold text-foreground">Pembahasan & Referensi Materi</h4>
              <p className="text-xs text-muted-foreground">
                Tinjau kunci jawaban, pilihan yang Anda buat, dan rujukan halaman PDF asli.
              </p>
            </div>

            {completedAttempt.questions.map((q, idx) => {
              const isCorrect = q.isCorrect;
              return (
                <Card
                  key={q.id}
                  className={`p-5 sm:p-6 border shadow-xs transition-colors ${
                    isCorrect
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-destructive/30 bg-destructive/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground mt-0.5">
                        {idx + 1}
                      </span>
                      <p className="text-xs sm:text-sm font-semibold text-foreground leading-snug">
                        {q.question}
                      </p>
                    </div>
                    {isCorrect ? (
                      <span className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Benar</span>
                      </span>
                    ) : (
                      <span className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-destructive">
                        <XCircle className="h-4 w-4" />
                        <span>Salah</span>
                      </span>
                    )}
                  </div>

                  {/* Daftar Opsi Jawaban */}
                  <div className="mt-4 space-y-2">
                    {q.options.map((opt, optIdx) => {
                      const isOptionCorrect = optIdx === q.correctIndex;
                      const isUserChoice = optIdx === q.userSelectedIndex;

                      let optClass = 'border-border bg-card text-foreground';
                      let statusBadge = null;

                      if (isOptionCorrect && isUserChoice) {
                        optClass = 'border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold';
                        statusBadge = (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Pilihan Anda (Benar)</span>
                          </span>
                        );
                      } else if (isOptionCorrect) {
                        optClass = 'border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold';
                        statusBadge = (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Kunci Jawaban</span>
                          </span>
                        );
                      } else if (isUserChoice && !isCorrect) {
                        optClass = 'border-destructive/60 bg-destructive/10 text-destructive font-semibold';
                        statusBadge = (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive">
                            <XCircle className="h-3.5 w-3.5" />
                            <span>Pilihan Anda (Salah)</span>
                          </span>
                        );
                      }

                      return (
                        <div
                          key={optIdx}
                          className={`flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-xs sm:text-sm ${optClass}`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono text-xs text-muted-foreground font-bold">
                              {String.fromCharCode(65 + optIdx)}.
                            </span>
                            <span className="break-words">{opt}</span>
                          </div>
                          {statusBadge && <div className="ml-2 shrink-0">{statusBadge}</div>}
                        </div>
                      );
                    })}
                  </div>

                  {/* Kotak Pembahasan & Rujukan Halaman PDF */}
                  <div className="mt-4 rounded-lg border border-border bg-background/80 p-3.5 text-xs space-y-2">
                    <p className="font-semibold text-foreground text-xs">Pembahasan:</p>
                    <p className="text-muted-foreground leading-relaxed text-xs">
                      {q.explanation}
                    </p>
                    {q.pageReferences && q.pageReferences.length > 0 && onNavigateToPage && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => onNavigateToPage(q.pageReferences[0])}
                          className="hover:text-primary transition-colors inline-flex items-center gap-1 text-primary underline underline-offset-2 text-xs font-semibold"
                          title={`Buka halaman ${q.pageReferences.join(', ')} di pembaca PDF`}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span>Buka Referensi Halaman {q.pageReferences.join(', ')}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ) : activeAttempt ? (
        /* Case 4: Runner Pengerjaan Kuis Aktif (Active Attempt) */
        <div className="space-y-5 max-w-2xl mx-auto">
          {/* Header Progres Soal & Status Draft */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground px-1">
            <span className="font-semibold text-foreground">
              Soal <span className="tabular-nums">{currentQuestionIndex + 1}</span> dari{' '}
              <span className="tabular-nums">{activeAttempt.questions.length}</span>
            </span>

            <div className="flex items-center gap-3">
              {draftSaveStatus === 'saving' ? (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
                  <Loader2 className="h-3 w-3 animate-spin text-primary" />
                  <span>Menyimpan jawaban...</span>
                </span>
              ) : draftSaveStatus === 'saved' ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                  <Check className="h-3 w-3" />
                  <span>Tersimpan</span>
                </span>
              ) : draftSaveStatus === 'error' ? (
                <button
                  type="button"
                  onClick={handleRetrySaveDraft}
                  className="inline-flex items-center gap-1 text-destructive text-xs font-semibold hover:underline"
                  title="Klik untuk mencoba simpan kembali"
                >
                  <AlertCircle className="h-3 w-3" />
                  <span>Gagal simpan (Coba lagi)</span>
                </button>
              ) : null}

              <span className="text-primary font-bold tabular-nums">
                {answeredCount} / {activeAttempt.questions.length} Terjawab
              </span>
            </div>
          </div>

          {/* Garis Bar Progres */}
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-200"
              style={{
                width: `${((currentQuestionIndex + 1) / activeAttempt.questions.length) * 100}%`,
              }}
            />
          </div>

          {draftSaveError && (
            <div
              role="alert"
              className="flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{draftSaveError}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetrySaveDraft}
                className="h-7 text-xs px-2 shrink-0"
              >
                Coba Lagi
              </Button>
            </div>
          )}

          {/* Kartu Pertanyaan Aktif */}
          {activeAttempt.questions[currentQuestionIndex] && (
            <Card className="p-6 sm:p-7 space-y-5 bg-card border-border shadow-xs">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary mt-0.5">
                  {currentQuestionIndex + 1}
                </span>
                <p className="text-sm sm:text-base font-semibold text-foreground leading-relaxed">
                  {activeAttempt.questions[currentQuestionIndex].question}
                </p>
              </div>

              {/* Daftar Pilihan Radio Semantik */}
              <div
                role="radiogroup"
                aria-label={`Pilihan jawaban untuk soal ${currentQuestionIndex + 1}`}
                className="space-y-2.5 pt-1"
              >
                {activeAttempt.questions[currentQuestionIndex].options.map((option, optIdx) => {
                  const currentQId = activeAttempt.questions[currentQuestionIndex].id;
                  const isSelected = userAnswers[currentQId] === optIdx;

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      tabIndex={0}
                      onClick={() => handleSelectOption(currentQId, optIdx)}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          handleSelectOption(currentQId, optIdx);
                        }
                      }}
                      className={`w-full flex items-center gap-3.5 rounded-xl border p-3.5 sm:p-4 text-left text-xs sm:text-sm transition-all cursor-pointer min-h-[44px] ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-foreground font-semibold ring-1 ring-primary shadow-xs'
                          : 'border-border bg-card text-foreground hover:bg-muted/40'
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border text-muted-foreground bg-muted/30'
                        }`}
                      >
                        {String.fromCharCode(65 + optIdx)}
                      </span>
                      <span className="break-words flex-1 leading-relaxed">{option}</span>
                    </button>
                  );
                })}
              </div>

              {/* Navigasi Soal Bawah */}
              <div className="flex items-center justify-between pt-5 border-t border-border">
                <Button
                  variant="ghost"
                  size="standard"
                  onClick={() => setCurrentQuestionIndex((i) => Math.max(0, i - 1))}
                  disabled={currentQuestionIndex === 0}
                  className="gap-1.5 text-xs min-h-[44px] sm:min-h-[36px]"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Sebelumnya</span>
                </Button>

                {currentQuestionIndex < activeAttempt.questions.length - 1 ? (
                  <Button
                    size="standard"
                    onClick={() => setCurrentQuestionIndex((i) => i + 1)}
                    className="gap-1.5 text-xs min-h-[44px] sm:min-h-[36px]"
                  >
                    <span>Selanjutnya</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    size="standard"
                    onClick={() => setIsSubmitConfirmOpen(true)}
                    className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white min-h-[44px] sm:min-h-[36px]"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Selesai & Kumpulkan</span>
                  </Button>
                )}
              </div>
            </Card>
          )}

          {/* Kisi Lompat Nomor Soal (Grid Indicator) */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {activeAttempt.questions.map((q, idx) => {
              const isAnswered = userAnswers[q.id] !== undefined;
              const isCurrent = idx === currentQuestionIndex;

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentQuestionIndex(idx)}
                  className={`h-8 w-8 rounded-lg text-xs font-bold transition-all cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center ${
                    isCurrent
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background'
                      : isAnswered
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/25'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                  title={`Buka soal ${idx + 1}${isAnswered ? ' (Sudah dijawab)' : ' (Belum dijawab)'}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>
      ) : selectedQuiz ? (
        /* Case 5: Halaman Pengantar Kuis (Landing Screen) */
        <Card className="p-8 sm:p-12 text-center bg-card max-w-xl mx-auto space-y-4 border-border shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <HelpCircle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">{selectedQuiz.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedQuiz.questionCount || selectedQuiz.targetCount} Soal Pilihan Ganda • Pembahasan Lengkap
            </p>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
            Jawab soal pilihan ganda satu per satu. Jawaban sementara tersimpan otomatis di server sehingga Anda dapat melanjutkan kapan saja sebelum mengumpulkan.
          </p>

          <div className="pt-2">
            <Button
              size="standard"
              onClick={() => handleStartAttempt(selectedQuiz.id)}
              disabled={isStartingAttempt || isArchived}
              className="gap-2 px-6 text-xs h-10"
            >
              {isStartingAttempt ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Mempersiapkan Soal...</span>
                </>
              ) : (
                <span>Mulai Kerjakan Kuis</span>
              )}
            </Button>
          </div>
        </Card>
      ) : null}

      {/* Dialog Konfirmasi Submit Kuis */}
      <Dialog open={isSubmitConfirmOpen} onOpenChange={setIsSubmitConfirmOpen}>
        <DialogContent className="sm:max-w-[420px] p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Kumpulkan Jawaban Kuis?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
              {unansweredCount > 0 ? (
                <span className="text-amber-600 dark:text-amber-400 font-semibold block">
                  Perhatian: Terdapat {unansweredCount} soal yang belum Anda jawab.
                </span>
              ) : (
                <span>Seluruh pertanyaan telah Anda jawab.</span>
              )}
            </DialogDescription>
          </DialogHeader>

          <p className="text-xs text-muted-foreground py-2 leading-relaxed">
            Apakah Anda yakin ingin menyelesaikan kuis ini sekarang? Nilai akhir dan pembahasan rujukan materi akan langsung dievaluasi oleh sistem.
          </p>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="standard"
              onClick={() => setIsSubmitConfirmOpen(false)}
              disabled={isSubmittingAttempt}
            >
              Periksa Kembali
            </Button>
            <Button
              size="standard"
              onClick={handleConfirmSubmit}
              disabled={isSubmittingAttempt}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSubmittingAttempt ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Menilai...</span>
                </>
              ) : (
                <span>Ya, Kumpulkan Jawaban</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Konfigurasi Pembuatan Kuis AI */}
      <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
        <DialogContent className="sm:max-w-[420px] p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Buat Kuis dengan AI
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
              Pilih jumlah soal pilihan ganda yang ingin dibuat dari materi perkuliahan ini.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <label className="text-xs font-semibold text-foreground">Jumlah Soal</label>
            <div className="grid grid-cols-2 gap-3">
              {[5, 10].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setTargetCount(count as 5 | 10)}
                  className={`rounded-xl border p-3.5 text-center transition-all cursor-pointer ${
                    targetCount === count
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                      : 'border-border bg-card text-foreground hover:bg-muted/40'
                  }`}
                >
                  <span className="text-base sm:text-lg">{count}</span>
                  <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                    Soal Pilihan Ganda
                  </span>
                </button>
              ))}
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed pt-1">
              Pembuatan kuis menggunakan kuota AI harian Anda. Setiap soal memiliki 4 opsi jawaban dan dilengkapi rujukan pembahasan ke dokumen PDF asli.
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
