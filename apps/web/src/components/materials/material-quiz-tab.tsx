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
} from 'lucide-react';
import {
  Quiz,
  ClientQuizQuestion,
  CompletedQuizQuestion,
  QuizAttemptResponse,
  StartQuizAttemptResponse,
} from '@studyflow/shared';
import {
  getMaterialQuizzes,
  generateQuiz,
  startQuizAttempt,
  saveQuizDraftAnswers,
  submitQuizAttempt,
  getQuizAttemptResult,
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

  // Generate Dialog
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = React.useState(false);
  const [targetCount, setTargetCount] = React.useState<5 | 10>(5);
  const [isSubmittingGen, setIsSubmittingGen] = React.useState(false);

  // Active Attempt State
  const [activeAttempt, setActiveAttempt] = React.useState<StartQuizAttemptResponse | null>(null);
  const [userAnswers, setUserAnswers] = React.useState<Record<string, number>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = React.useState(0);
  const [isStartingAttempt, setIsStartingAttempt] = React.useState(false);
  const [isSubmittingAttempt, setIsSubmittingAttempt] = React.useState(false);

  // Submit confirmation dialog
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = React.useState(false);

  // Finished Attempt Review State
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
      setErrorMessage(err.message || 'Gagal memuat kuis');
    } finally {
      setIsLoading(false);
    }
  }, [materialId]);

  React.useEffect(() => {
    loadQuizzes();
  }, [loadQuizzes]);

  // Polling for QUEUED or PROCESSING quizzes
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
      setUserAnswers(attemptRes.existingAnswers || {});
      setCurrentQuestionIndex(0);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memulai kuis');
    } finally {
      setIsStartingAttempt(false);
    }
  };

  const handleSelectOption = (questionId: string, optionIndex: number) => {
    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex,
    }));
    if (activeAttempt) {
      saveQuizDraftAnswers(activeAttempt.attemptId, [
        { questionId, selectedIndex: optionIndex },
      ]).catch((err) => {
        console.error('Failed to save draft answer:', err);
      });
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
      setErrorMessage(err.message || 'Gagal mengirimkan jawaban kuis');
    } finally {
      setIsSubmittingAttempt(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-3 text-sm">Memuat kuis materi...</p>
      </div>
    );
  }

  const answeredCount = Object.keys(userAnswers).length;
  const totalInAttempt = activeAttempt?.questions.length || 0;
  const unansweredCount = totalInAttempt - answeredCount;

  return (
    <div className="space-y-6">
      {/* Header & Quiz Selector / Action */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">Kuis Pemahaman Materi</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Uji sejauh mana Anda memahami materi dengan soal pilihan ganda otomatis dan pembahasan berbasis halaman dokumen.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {quizzes.length > 0 && !activeAttempt && !completedAttempt && (
            <select
              value={selectedQuiz?.id || ''}
              onChange={(e) => {
                const found = quizzes.find((q) => q.id === e.target.value);
                if (found) {
                  setSelectedQuiz(found);
                }
              }}
              className="h-8 rounded-md border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {quizzes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title} ({q.questionCount || q.targetCount} soal)
                </option>
              ))}
            </select>
          )}

          {!activeAttempt && (
            <Button
              size="sm"
              onClick={() => setIsGenerateDialogOpen(true)}
              disabled={isArchived}
              className="gap-1.5 text-xs h-8"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span>Buat Kuis Baru</span>
            </Button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3 text-xs text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Case 1: Empty state (No quizzes yet) */}
      {quizzes.length === 0 ? (
        <Card className="p-12 text-center bg-card">
          <HelpCircle className="h-10 w-10 text-muted-foreground mx-auto" />
          <h3 className="mt-3 text-base font-semibold text-foreground">Belum Ada Kuis</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
            Hasilkan kuis pilihan ganda dari isi materi perkuliahan untuk menguji kesiapan ujian dan pemahaman Anda.
          </p>
          <Button
            size="sm"
            onClick={() => setIsGenerateDialogOpen(true)}
            disabled={isArchived}
            className="mt-4 gap-2"
          >
            <Sparkles className="h-4 w-4 text-amber-300" />
            <span>Buat Kuis Sekarang</span>
          </Button>
        </Card>
      ) : selectedQuiz?.status === 'QUEUED' || selectedQuiz?.status === 'PROCESSING' ? (
        /* Case 2: In-Progress Generation */
        <Card className="p-12 text-center bg-card">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <h3 className="mt-4 text-base font-semibold text-foreground">Menyusun Soal Kuis AI...</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
            AI sedang menganalisis isi materi dan merancang pertanyaan pilihan ganda yang mendalam lengkap dengan pembahasan.
          </p>
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground font-medium">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span>Memproses di background worker</span>
          </div>
        </Card>
      ) : completedAttempt ? (
        /* Case 3: Completed Attempt Score & Review */
        <div className="space-y-6 max-w-2xl mx-auto">
          {/* Result Card Banner */}
          <Card className="p-6 text-center border-primary/20 bg-primary/5">
            <Award className="h-12 w-12 text-amber-500 mx-auto" />
            <h3 className="mt-2 text-lg font-bold text-foreground">Hasil Pengerjaan Kuis</h3>
            <div className="mt-3 flex items-center justify-center gap-6">
              <div>
                <span className="text-3xl font-black text-primary">
                  {completedAttempt.score}
                </span>
                <span className="block text-xs text-muted-foreground mt-0.5">Nilai (0-100)</span>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <span className="text-2xl font-bold text-foreground">
                  {completedAttempt.correctAnswersCount} / {completedAttempt.totalQuestions}
                </span>
                <span className="block text-xs text-muted-foreground mt-0.5">Jawaban Benar</span>
              </div>
            </div>

            <div className="mt-6 flex justify-center gap-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setCompletedAttempt(null);
                  if (selectedQuiz) handleStartAttempt(selectedQuiz.id);
                }}
                disabled={isArchived}
                className="gap-1.5 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Ulangi Kuis</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCompletedAttempt(null)}
                className="text-xs"
              >
                Kembali ke Beranda Kuis
              </Button>
            </div>
          </Card>

          {/* Question Review List */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-foreground">Pembahasan & Referensi Materi</h4>
            {completedAttempt.questions.map((q, idx) => {
              const isCorrect = q.isCorrect;
              return (
                <Card
                  key={q.id}
                  className={`p-5 border transition-all ${
                    isCorrect
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-danger/30 bg-danger/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-foreground">
                        {idx + 1}
                      </span>
                      <p className="text-xs sm:text-sm font-semibold text-foreground leading-snug">
                        {q.question}
                      </p>
                    </div>
                    {isCorrect ? (
                      <span className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" /> Benar
                      </span>
                    ) : (
                      <span className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-danger">
                        <XCircle className="h-4 w-4" /> Salah
                      </span>
                    )}
                  </div>

                  {/* Options List */}
                  <div className="mt-3 space-y-2">
                    {q.options.map((opt, optIdx) => {
                      const isOptionCorrect = optIdx === q.correctIndex;
                      const isUserChoice = optIdx === q.userSelectedIndex;

                      let optClass = 'border-border bg-card text-foreground';
                      if (isOptionCorrect) {
                        optClass = 'border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium';
                      } else if (isUserChoice && !isCorrect) {
                        optClass = 'border-danger/60 bg-danger/10 text-danger font-medium';
                      }

                      return (
                        <div
                          key={optIdx}
                          className={`flex items-center justify-between rounded-md border px-3 py-2 text-xs ${optClass}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {String.fromCharCode(65 + optIdx)}.
                            </span>
                            <span>{opt}</span>
                          </div>
                          {isOptionCorrect && (
                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                              Kunci Jawaban
                            </span>
                          )}
                          {isUserChoice && !isOptionCorrect && (
                            <span className="text-[10px] font-semibold text-danger">
                              Pilihan Anda
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation & PDF Reference */}
                  <div className="mt-3 rounded border border-border/80 bg-background/60 p-3 text-xs space-y-1.5">
                    <p className="font-semibold text-foreground text-[11px]">Pembahasan:</p>
                    <p className="text-muted-foreground leading-relaxed text-[11px]">
                      {q.explanation}
                    </p>
                    {q.pageReferences && q.pageReferences.length > 0 && onNavigateToPage && (
                      <button
                        type="button"
                        onClick={() => onNavigateToPage(q.pageReferences[0])}
                        className="hover:text-primary transition-colors flex items-center gap-1 text-primary underline underline-offset-2 text-[11px] pt-1"
                      >
                        <FileText className="h-3 w-3" />
                        <span>Buka Referensi Halaman {q.pageReferences.join(', ')}</span>
                      </button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ) : activeAttempt ? (
        /* Case 4: Live Quiz Attempt Runner */
        <div className="space-y-6 max-w-2xl mx-auto">
          {/* Progress Indicator */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              Soal {currentQuestionIndex + 1} dari {activeAttempt.questions.length}
            </span>
            <span className="text-primary font-medium">
              {answeredCount} / {activeAttempt.questions.length} Terjawab
            </span>
          </div>

          {/* Progress bar line */}
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{
                width: `${((currentQuestionIndex + 1) / activeAttempt.questions.length) * 100}%`,
              }}
            />
          </div>

          {/* Question Card */}
          {activeAttempt.questions[currentQuestionIndex] && (
            <Card className="p-6 space-y-5 bg-card">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {currentQuestionIndex + 1}
                </span>
                <p className="text-sm sm:text-base font-semibold text-foreground leading-relaxed">
                  {activeAttempt.questions[currentQuestionIndex].question}
                </p>
              </div>

              {/* Options Radio List */}
              <div className="space-y-2.5 pt-2">
                {activeAttempt.questions[currentQuestionIndex].options.map((option, optIdx) => {
                  const currentQId = activeAttempt.questions[currentQuestionIndex].id;
                  const isSelected = userAnswers[currentQId] === optIdx;

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => handleSelectOption(currentQId, optIdx)}
                      className={`w-full flex items-center gap-3 rounded-lg border p-3.5 text-left text-xs sm:text-sm transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-foreground font-medium ring-1 ring-primary'
                          : 'border-border bg-card text-foreground hover:bg-muted/40'
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                          isSelected
                            ? 'border-primary bg-primary text-white'
                            : 'border-border text-muted-foreground'
                        }`}
                      >
                        {String.fromCharCode(65 + optIdx)}
                      </span>
                      <span>{option}</span>
                    </button>
                  );
                })}
              </div>

              {/* Bottom question actions */}
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentQuestionIndex((i) => Math.max(0, i - 1))}
                  disabled={currentQuestionIndex === 0}
                  className="gap-1 text-xs"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Sebelumnya</span>
                </Button>

                {currentQuestionIndex < activeAttempt.questions.length - 1 ? (
                  <Button
                    size="sm"
                    onClick={() => setCurrentQuestionIndex((i) => i + 1)}
                    className="gap-1 text-xs"
                  >
                    <span>Selanjutnya</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => setIsSubmitConfirmOpen(true)}
                    className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Selesai & Kumpulkan</span>
                  </Button>
                )}
              </div>
            </Card>
          )}

          {/* Question Grid jump navigation */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {activeAttempt.questions.map((q, idx) => {
              const isAnswered = userAnswers[q.id] !== undefined;
              const isCurrent = idx === currentQuestionIndex;

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentQuestionIndex(idx)}
                  className={`h-7 w-7 rounded text-xs font-semibold transition-all ${
                    isCurrent
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1'
                      : isAnswered
                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>
      ) : selectedQuiz ? (
        /* Case 5: Quiz Landing Screen */
        <Card className="p-8 text-center bg-card max-w-xl mx-auto space-y-4">
          <HelpCircle className="h-10 w-10 text-primary mx-auto" />
          <div>
            <h3 className="text-lg font-bold text-foreground">{selectedQuiz.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedQuiz.questionCount || selectedQuiz.targetCount} Soal Pilihan Ganda • Pembahasan Lengkap
            </p>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
            Jawab soal pilihan ganda satu per satu. Anda dapat meninjau kembali jawaban sebelum mengumpulkan ke sistem untuk mendapatkan nilai instan.
          </p>

          <Button
            size="sm"
            onClick={() => handleStartAttempt(selectedQuiz.id)}
            disabled={isStartingAttempt || isArchived}
            className="gap-2 px-6"
          >
            {isStartingAttempt ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Mempersiapkan Soal...</span>
              </>
            ) : (
              <>
                <span>Mulai Kerjakan Kuis</span>
              </>
            )}
          </Button>
        </Card>
      ) : null}

      {/* Submit Confirmation Dialog */}
      <Dialog open={isSubmitConfirmOpen} onOpenChange={setIsSubmitConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kumpulkan Jawaban Kuis?</DialogTitle>
            <DialogDescription>
              {unansweredCount > 0 ? (
                <span className="text-warning font-semibold">
                  Perhatian: Terdapat {unansweredCount} soal yang belum Anda jawab.
                </span>
              ) : (
                'Seluruh pertanyaan telah Anda jawab.'
              )}
            </DialogDescription>
          </DialogHeader>

          <p className="text-xs text-muted-foreground py-2 leading-relaxed">
            Apakah Anda yakin ingin menyelesaikan kuis ini sekarang? Nilai dan pembahasan akan langsung dihitung oleh sistem.
          </p>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsSubmitConfirmOpen(false)}
              disabled={isSubmittingAttempt}
            >
              Periksa Kembali
            </Button>
            <Button
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

      {/* Generation Setup Dialog */}
      <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buat Kuis dengan AI</DialogTitle>
            <DialogDescription>
              Pilih jumlah soal yang ingin dibuat dari materi perkuliahan ini.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <label className="text-xs font-semibold text-foreground">Jumlah Soal</label>
            <div className="grid grid-cols-2 gap-3">
              {[5, 10].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setTargetCount(count as 5 | 10)}
                  className={`rounded-lg border p-4 text-center transition-all ${
                    targetCount === count
                      ? 'border-primary bg-primary/10 text-primary font-bold'
                      : 'border-border bg-card text-foreground hover:bg-muted/50'
                  }`}
                >
                  <span className="text-lg">{count}</span>
                  <span className="block text-[11px] font-normal text-muted-foreground mt-0.5">
                    Soal Pilihan Ganda
                  </span>
                </button>
              ))}
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Membuat kuis menggunakan kuota AI harian Anda. Soal dirancang dengan 4 pilihan jawaban dan dilengkapi pembahasan rujukan dokumen PDF.
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
