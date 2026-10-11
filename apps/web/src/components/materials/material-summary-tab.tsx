'use client';

import * as React from 'react';
import {
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  Loader2,
  Info,
  BookOpen,
  ArrowRight,
  FileText,
} from 'lucide-react';
import {
  MaterialSummary,
  AiQuotaStatus,
  KeyConcept,
  SummarySection,
  KeyTerm,
} from '@studyflow/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface MaterialSummaryTabProps {
  summary: MaterialSummary | null;
  quota: AiQuotaStatus | null;
  isGenerating: boolean;
  error: string | null;
  isArchived: boolean;
  onGenerate: (regenerate?: boolean) => void;
  onOpenRegenerateDialog: () => void;
  onJumpToPage: (pageNumber: number) => void;
  onCopySummary: () => void;
  copiedSummary: boolean;
}

export function MaterialSummaryTab({
  summary,
  quota,
  isGenerating,
  error,
  isArchived,
  onGenerate,
  onOpenRegenerateDialog,
  onJumpToPage,
  onCopySummary,
  copiedSummary,
}: MaterialSummaryTabProps): React.JSX.Element {
  const isWorking =
    summary?.status === 'QUEUED' ||
    summary?.status === 'PROCESSING' ||
    isGenerating;

  // 1. Error Banner
  const renderError = error && (
    <div
      role="alert"
      className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive"
    >
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span className="leading-relaxed">{error}</span>
    </div>
  );

  // 2. State In-Progress (Queue / Processing)
  if (isWorking) {
    return (
      <div className="space-y-4">
        {renderError}
        <Card className="border border-border bg-card p-8 sm:p-12 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">
            Menyusun Ringkasan Dokumen...
          </h3>
          <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Model AI sedang membaca seluruh teks materi perkuliahan untuk mengekstrak konsep kunci, struktur pembahasan, dan istilah penting dengan rujukan halaman.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3.5 py-1 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span>Memproses di antrean sistem</span>
          </div>
        </Card>
      </div>
    );
  }

  // 3. State Ready (Summary Tersedia)
  if (summary?.status === 'READY') {
    const keyConcepts = (summary.keyConcepts as KeyConcept[]) || [];
    const sections = (summary.sections as SummarySection[]) || [];
    const keyTerms = (summary.keyTerms as KeyTerm[]) || [];

    return (
      <div className="space-y-6">
        {renderError}

        {/* Disclaimer Keandalan AI */}
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-foreground">
          <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <p className="text-muted-foreground leading-relaxed">
            Ringkasan disusun otomatis oleh asisten belajar AI. Gunakan tombol referensi halaman (mis. <span className="font-semibold text-foreground">Hal. 4</span>) untuk memverifikasi materi langsung pada dokumen PDF aslinya.
          </p>
        </div>

        {/* Header Ringkasan & Toolbar Aksi */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                {summary.title || 'Ringkasan Materi'}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span>{summary.sourcePageCount} halaman dianalisis</span>
              {quota && (
                <>
                  <span>•</span>
                  <span>Sisa kuota harian: {quota.dailyRemaining}/{quota.dailyLimit}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="standard"
              onClick={onCopySummary}
              className="gap-1.5 text-xs"
              aria-label="Salin seluruh isi ringkasan"
            >
              {copiedSummary ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Salin Teks</span>
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="standard"
              onClick={onOpenRegenerateDialog}
              disabled={isArchived || Boolean(quota && quota.dailyRemaining <= 0)}
              className="gap-1.5 text-xs text-primary hover:text-primary"
              aria-label="Buat ulang ringkasan dengan AI"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Regenerasi</span>
            </Button>
          </div>
        </div>

        {/* Konten Ringkasan Bergaya Buku / Catatan Akademik */}
        <div className="max-w-3xl space-y-8 text-foreground">
          {/* Section 1: Ringkasan Utama */}
          {summary.overview && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Ringkasan Utama
              </h3>
              <p className="text-sm sm:text-base leading-relaxed text-foreground/90 whitespace-pre-line">
                {summary.overview}
              </p>
            </section>
          )}

          {/* Section 2: Konsep Kunci */}
          {keyConcepts.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Konsep Kunci
              </h3>
              <div className="divide-y divide-border/60 border-t border-b border-border/60">
                {keyConcepts.map((item, idx) => (
                  <div key={idx} className="py-3.5 space-y-1.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h4 className="font-semibold text-sm sm:text-base text-foreground">
                        {item.concept}
                      </h4>
                      {item.pageReferences && item.pageReferences.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {item.pageReferences.map((pg) => (
                            <button
                              key={pg}
                              type="button"
                              onClick={() => onJumpToPage(pg)}
                              className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                              title={`Buka halaman ${pg} di dokumen PDF`}
                              aria-label={`Buka halaman ${pg} di dokumen PDF untuk konsep ${item.concept}`}
                            >
                              <span>Hal. {pg}</span>
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      {item.explanation}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Section 3: Struktur & Bagian Materi */}
          {sections.length > 0 && (
            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Struktur & Bagian Materi
              </h3>
              <div className="space-y-5">
                {sections.map((sec, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h4 className="font-semibold text-sm sm:text-base text-foreground">
                        {sec.heading}
                      </h4>
                      {sec.pageReferences && sec.pageReferences.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {sec.pageReferences.map((pg) => (
                            <button
                              key={pg}
                              type="button"
                              onClick={() => onJumpToPage(pg)}
                              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                              title={`Lihat pembahasan di halaman ${pg}`}
                              aria-label={`Lihat bagian ${sec.heading} di halaman ${pg}`}
                            >
                              <span>Hal. {pg}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                      {sec.content}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Section 4: Istilah & Glosarium Penting */}
          {keyTerms.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Istilah Penting
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {keyTerms.map((t, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-border/70 bg-card p-3 space-y-1 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-foreground">
                        {t.term}
                      </span>
                      {t.pageReferences && t.pageReferences.length > 0 && (
                        <div className="flex items-center gap-1">
                          {t.pageReferences.map((pg) => (
                            <button
                              key={pg}
                              type="button"
                              onClick={() => onJumpToPage(pg)}
                              className="text-[11px] text-primary hover:underline font-medium"
                              title={`Buka halaman ${pg}`}
                              aria-label={`Buka halaman ${pg} untuk istilah ${t.term}`}
                            >
                              Hal. {pg}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {t.definition}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Section 5: Catatan / Batasan Materi */}
          {summary.limitations && (
            <div className="rounded-lg border border-border/80 bg-muted/20 p-3.5 text-xs text-muted-foreground space-y-1">
              <span className="font-semibold text-foreground">Catatan Tambahan:</span>
              <p className="leading-relaxed">{summary.limitations}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 4. State Gagal (Failed)
  if (summary?.status === 'FAILED') {
    return (
      <div className="space-y-4">
        {renderError}
        <Card className="border border-destructive/30 bg-destructive/5 p-6 sm:p-10 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-base font-semibold text-destructive">
            Gagal Membuat Ringkasan AI
          </h3>
          <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            {summary.errorMessage ||
              'Terjadi kendala saat memproses ringkasan dengan layanan AI. Kuota harian Anda tidak terpotong untuk percobaan yang gagal.'}
          </p>
          <div className="mt-5 flex justify-center">
            <Button
              variant="outline"
              size="standard"
              onClick={() => onGenerate(false)}
              disabled={isGenerating || Boolean(quota && quota.dailyRemaining <= 0)}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Coba Buat Lagi</span>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // 5. State Belum Dibuat (Initial Onboarding)
  return (
    <div className="space-y-4">
      {renderError}
      <Card className="border border-dashed border-border bg-card/60 p-8 sm:p-12 text-center shadow-xs">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>

        <div className="mt-3 space-y-1.5 max-w-md mx-auto">
          <h3 className="text-base font-semibold text-foreground">
            Ringkas Materi Ini dengan AI
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Dapatkan intisari materi perkuliahan secara otomatis: rangkuman bab utama, konsep kunci, dan glosarium istilah penting yang tertaut langsung ke nomor halaman dokumen PDF.
          </p>
        </div>

        {quota && (
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3.5 py-1 text-xs text-muted-foreground font-medium">
            <span>Sisa kuota harian:</span>
            <span className="font-bold text-foreground">
              {quota.dailyRemaining} / {quota.dailyLimit}
            </span>
            <span>ringkasan</span>
          </div>
        )}

        <div className="mt-6 flex justify-center">
          <Button
            size="standard"
            onClick={() => onGenerate(false)}
            disabled={
              isGenerating ||
              isArchived ||
              Boolean(quota && quota.dailyRemaining <= 0)
            }
            className="gap-2 text-xs shadow-xs"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Menyiapkan Antrean...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Buat Ringkasan AI Sekarang</span>
              </>
            )}
          </Button>
        </div>

        {isArchived && (
          <p className="mt-3 text-xs text-warning">
            Materi ini berada dalam semester atau mata kuliah yang diarsipkan sehingga tidak dapat menghasilkan ringkasan baru.
          </p>
        )}

        {quota && quota.dailyRemaining <= 0 && (
          <p className="mt-3 text-xs text-destructive">
            Batas kuota ringkasan AI harian Anda telah habis hari ini dan akan diperbarui besok.
          </p>
        )}
      </Card>
    </div>
  );
}
