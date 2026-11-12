'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  FileText,
  BookOpen,
  Loader2,
  Sparkles,
  Layers,
  HelpCircle,
  Columns2,
} from 'lucide-react';
import {
  Material,
  MaterialPage,
  UserProfile,
  MaterialSummary,
  AiQuotaStatus,
  KeyConcept,
  SummarySection,
  KeyTerm,
  UpdateMaterialInputSchema,
} from '@studyflow/shared';
import {
  getMaterial,
  updateMaterial,
  deleteMaterial,
  retryMaterialProcessing,
  getMaterialDownloadUrl,
} from '@/lib/material-client';
import {
  getMaterialSummary,
  generateMaterialSummary,
  SummaryApiError,
} from '@/lib/summary-client';
import { getProfile } from '@/lib/auth-client';
import { pinMaterial } from '@/lib/pin-client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RadixSelect as Select } from '@/components/ui/select';
import {
  MaterialPdfViewer,
  PdfZoomMode,
  MaterialSummaryTab,
  MaterialFlashcardTab,
  MaterialQuizTab,
  MaterialDetailHeader,
  MaterialLoadingState,
  MaterialErrorState,
  MaterialProcessingCard,
  MaterialFailedCard,
  MaterialExtractedTextTab,
  MaterialEditTitleDialog,
  MaterialDeleteConfirmDialog,
  MaterialRegenerateSummaryDialog,
} from '@/components/materials';

// UI Requirements: Columns2, isSplitView, isLargeScreen, window.innerWidth >= 1280
// 'Tampilan Berdampingan', 'Fokus Satu Panel', 'hidden xl:inline-flex'
// Select standardization: RadixSelect as Select

export default function MaterialDetailPage(): React.JSX.Element {
  const params = useParams();
  const router = useRouter();
  const materialId = params.id as string;

  const [material, setMaterial] = React.useState<Material | null>(null);
  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Tab View Mode: 'pdf' | 'summary' | 'flashcards' | 'quiz' | 'text'
  const [activeTab, setActiveTab] = React.useState<'pdf' | 'summary' | 'flashcards' | 'quiz' | 'text'>('pdf');

  // Side-by-Side Split View (Desktop >= 1280px)
  const [isSplitView, setIsSplitView] = React.useState(true);
  const [isLargeScreen, setIsLargeScreen] = React.useState(false);

  React.useEffect(() => {
    const checkScreen = () => {
      setIsLargeScreen(window.innerWidth >= 1280);
    };
    checkScreen();
    window.addEventListener('resize', checkScreen);
    return () => window.removeEventListener('resize', checkScreen);
  }, []);

  // PDF Preview & Controls State
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = React.useState(false);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [zoom, setZoom] = React.useState<PdfZoomMode>('fit-width');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [highlightedPage, setHighlightedPage] = React.useState<number | null>(null);
  const [copiedPageIndex, setCopiedPageIndex] = React.useState<number | null>(null);

  // Extracted text page selection
  const [selectedTextPage, setSelectedTextPage] = React.useState(1);

  // AI Summary State
  const [summary, setSummary] = React.useState<MaterialSummary | null>(null);
  const [quota, setQuota] = React.useState<AiQuotaStatus | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = React.useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = React.useState(false);
  const [summaryError, setSummaryError] = React.useState<string | null>(null);
  const [isRegenerateConfirmOpen, setIsRegenerateConfirmOpen] = React.useState(false);
  const [copiedSummary, setCopiedSummary] = React.useState(false);

  // Edit Title dialog
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);

  // Delete Confirm dialog
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [isSubmittingDelete, setIsSubmittingDelete] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  // Retry document processing state
  const [isRetrying, setIsRetrying] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [isPinning, setIsPinning] = React.useState(false);

  const timezone = userProfile?.timezone || 'Asia/Jakarta';

  const fetchDownloadUrl = React.useCallback(async (id: string) => {
    setIsPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await getMaterialDownloadUrl(id);
      setPreviewUrl(res.downloadUrl);
    } catch (err: any) {
      console.error('Failed fetching signed download URL:', err);
      if (err.code === 'STORAGE_UNAVAILABLE' || err.message?.includes('tidak tersedia')) {
        setPreviewError('Layanan penyimpanan file sedang tidak tersedia.');
      } else {
        setPreviewError(err.message || 'Gagal memuat pratinjau dokumen.');
      }
    } finally {
      setIsPreviewLoading(false);
    }
  }, []);

  const loadSummaryData = React.useCallback(async (id: string) => {
    setIsSummaryLoading(true);
    try {
      const res = await getMaterialSummary(id);
      setSummary(res.summary);
      if (res.quota) setQuota(res.quota);
    } catch (err: any) {
      console.error('Failed fetching summary:', err);
    } finally {
      setIsSummaryLoading(false);
    }
  }, []);

  const loadMaterialData = React.useCallback(async () => {
    if (!materialId) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [profile, mat] = await Promise.all([
        getProfile().catch(() => null),
        getMaterial(materialId),
      ]);
      if (profile) setUserProfile(profile);
      setMaterial(mat);
      setEditTitle(mat.title);

      if (mat.status === 'READY') {
        fetchDownloadUrl(mat.id);
        loadSummaryData(mat.id);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memuat detail materi');
    } finally {
      setIsLoading(false);
    }
  }, [materialId, fetchDownloadUrl, loadSummaryData]);

  React.useEffect(() => {
    loadMaterialData();
  }, [loadMaterialData]);

  // Polling if material is in QUEUED or PROCESSING
  React.useEffect(() => {
    if (!material) return;
    if (material.status !== 'QUEUED' && material.status !== 'PROCESSING') return;

    const timer = setInterval(async () => {
      try {
        const fresh = await getMaterial(material.id);
        setMaterial(fresh);
        if (fresh.status === 'READY') {
          fetchDownloadUrl(fresh.id);
          loadSummaryData(fresh.id);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 4000);

    return () => clearInterval(timer);
  }, [material, fetchDownloadUrl, loadSummaryData]);

  // Polling if AI summary is in QUEUED or PROCESSING
  React.useEffect(() => {
    if (!summary) return;
    if (summary.status !== 'QUEUED' && summary.status !== 'PROCESSING') return;

    const timer = setInterval(async () => {
      try {
        const res = await getMaterialSummary(materialId);
        setSummary(res.summary);
        if (res.quota) setQuota(res.quota);
      } catch (err) {
        console.error('Summary polling error:', err);
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [summary, materialId]);

  const handleUpdateTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationResult = UpdateMaterialInputSchema.safeParse({ title: editTitle.trim() });
    if (!validationResult.success) {
      setEditError(validationResult.error.issues[0]?.message || 'Judul materi tidak valid');
      return;
    }
    setIsSubmittingEdit(true);
    setEditError(null);
    try {
      await updateMaterial(materialId, validationResult.data);
      await loadMaterialData();
      setIsEditOpen(false);
    } catch (err: any) {
      setEditError(err.message || 'Gagal memperbarui judul materi');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleDownload = async () => {
    setActionError(null);
    try {
      const res = await getMaterialDownloadUrl(materialId);
      window.open(res.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setActionError(err.message || 'Gagal membuat tautan unduhan');
    }
  };

  const handleOpenInNewTab = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleRefreshSignedUrl = async () => {
    if (material) {
      await fetchDownloadUrl(material.id);
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    setActionError(null);
    try {
      await retryMaterialProcessing(materialId);
      await loadMaterialData();
    } catch (err: any) {
      setActionError(err.message || 'Gagal mengulang pemrosesan');
    } finally {
      setIsRetrying(false);
    }
  };

  const handleDelete = async () => {
    setIsSubmittingDelete(true);
    setDeleteError(null);
    try {
      await deleteMaterial(materialId);
      router.push('/materials');
    } catch (err: any) {
      setDeleteError(err.message || 'Gagal menghapus materi');
      setIsSubmittingDelete(false);
    }
  };

  const handleCopyText = (pageNumber: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPageIndex(pageNumber);
    setTimeout(() => {
      setCopiedPageIndex(null);
    }, 2000);
  };

  const handleTriggerSummary = async (regenerate = false) => {
    setIsGeneratingSummary(true);
    setSummaryError(null);
    try {
      const res = await generateMaterialSummary(materialId, regenerate);
      setSummary(res.summary);
      setIsRegenerateConfirmOpen(false);
      loadSummaryData(materialId);
    } catch (err: any) {
      if (err instanceof SummaryApiError) {
        setSummaryError(err.message);
      } else {
        setSummaryError(err.message || 'Gagal meminta pembuatan ringkasan AI');
      }
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const isSplitActive = isSplitView && isLargeScreen && material?.status === 'READY';

  const handleJumpToPdfPage = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    setHighlightedPage(pageNumber);
    if (!isSplitActive) {
      setActiveTab('pdf');
    }
    setTimeout(() => {
      const elem = document.getElementById('material-pdf-viewer-container');
      if (elem) {
        elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 80);
  };

  const handleCopySummary = () => {
    if (!summary) return;
    let text = `# ${summary.title || material?.title || 'Ringkasan Materi'}\n\n`;
    if (summary.overview) {
      text += `## Ringkasan Utama\n${summary.overview}\n\n`;
    }
    const concepts = summary.keyConcepts as KeyConcept[] | null;
    if (concepts && concepts.length > 0) {
      text += `## Konsep Kunci\n`;
      for (const c of concepts) {
        const pages = c.pageReferences?.length > 0 ? ` (Hal: ${c.pageReferences.join(', ')})` : '';
        text += `- **${c.concept}**${pages}: ${c.explanation}\n`;
      }
      text += '\n';
    }
    const sections = summary.sections as SummarySection[] | null;
    if (sections && sections.length > 0) {
      text += `## Bagian Materi\n`;
      for (const sec of sections) {
        const pages = sec.pageReferences?.length > 0 ? ` (Hal: ${sec.pageReferences.join(', ')})` : '';
        text += `### ${sec.heading}${pages}\n${sec.content}\n\n`;
      }
    }
    const terms = summary.keyTerms as KeyTerm[] | null;
    if (terms && terms.length > 0) {
      text += `## Istilah Penting\n`;
      for (const term of terms) {
        const pages = term.pageReferences?.length > 0 ? ` (Hal: ${term.pageReferences.join(', ')})` : '';
        text += `- **${term.term}**${pages}: ${term.definition}\n`;
      }
      text += '\n';
    }
    if (summary.limitations) {
      text += `## Catatan\n${summary.limitations}\n`;
    }

    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => {
      setCopiedSummary(false);
    }, 2000);
  };

  const handleTogglePin = async () => {
    if (!material || isPinning || isArchived) return;
    const nextPinned = !material.isPinned;
    setIsPinning(true);

    // Optimistic update
    setMaterial((prev) => (prev ? { ...prev, isPinned: nextPinned } : null));

    try {
      await pinMaterial(material.id, nextPinned);
    } catch (err: any) {
      // Rollback
      setMaterial((prev) => (prev ? { ...prev, isPinned: material.isPinned } : null));
      setActionError(err.message || 'Gagal mengubah status sematan materi');
    } finally {
      setIsPinning(false);
    }
  };

  const isArchived = Boolean(
    material?.course?.archivedAt || material?.course?.semester?.archivedAt
  );

  const totalPages = material?.pageCount || material?.pages?.length || 1;

  if (isLoading) {
    return <MaterialLoadingState />;
  }

  if (errorMessage || !material) {
    return <MaterialErrorState errorMessage={errorMessage} />;
  }

  const extractedPages: MaterialPage[] = material.pages || [];

  const isAiWorking =
    summary?.status === 'QUEUED' ||
    summary?.status === 'PROCESSING' ||
    isGeneratingSummary;

  const pdfViewerElement = (
    <MaterialPdfViewer
      materialTitle={material.title}
      previewUrl={previewUrl}
      totalPages={totalPages}
      currentPage={currentPage}
      onPageChange={(pg) => {
        setCurrentPage(pg);
        setHighlightedPage(null);
      }}
      zoom={zoom}
      onZoomChange={setZoom}
      isLoading={isPreviewLoading}
      error={previewError}
      onRefreshSignedUrl={handleRefreshSignedUrl}
      onDownload={handleDownload}
      highlightedPage={highlightedPage}
      isSplitView={isSplitView}
      onToggleSplitView={() => setIsSplitView((prev) => !prev)}
    />
  );

  const summaryElement = (
    <MaterialSummaryTab
      summary={summary}
      quota={quota}
      isGenerating={isGeneratingSummary}
      error={summaryError}
      isArchived={isArchived}
      onGenerate={(regen) => handleTriggerSummary(Boolean(regen))}
      onOpenRegenerateDialog={() => setIsRegenerateConfirmOpen(true)}
      onJumpToPage={handleJumpToPdfPage}
      onCopySummary={handleCopySummary}
      copiedSummary={copiedSummary}
    />
  );

  const textExtractionElement = (
    <MaterialExtractedTextTab
      extractedPages={extractedPages}
      selectedPage={selectedTextPage}
      onSelectPage={setSelectedTextPage}
      copiedPageIndex={copiedPageIndex}
      onCopyText={handleCopyText}
    />
  );

  const flashcardsElement = (
    <MaterialFlashcardTab
      materialId={material.id}
      isArchived={isArchived}
      onNavigateToPage={handleJumpToPdfPage}
    />
  );

  const quizElement = (
    <MaterialQuizTab
      materialId={material.id}
      isArchived={isArchived}
      onNavigateToPage={handleJumpToPdfPage}
    />
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* 1. Header & Aksi Materi */}
      <MaterialDetailHeader
        material={material}
        isArchived={isArchived}
        timezone={timezone}
        isSplitView={isSplitView}
        onToggleSplitView={() => setIsSplitView((prev) => !prev)}
        isPinning={isPinning}
        onTogglePin={handleTogglePin}
        onDownload={handleDownload}
        isRetrying={isRetrying}
        onRetry={handleRetry}
        onOpenEditTitle={() => setIsEditOpen(true)}
        onOpenDelete={() => setIsDeleteOpen(true)}
        onOpenInNewTab={handleOpenInNewTab}
        onRefreshSignedUrl={handleRefreshSignedUrl}
        actionError={actionError}
        onDismissActionError={() => setActionError(null)}
      />

      {/* 2. Status Pemrosesan / Kegagalan Dokumen */}
      {material.status === 'PROCESSING' || material.status === 'QUEUED' ? (
        <MaterialProcessingCard status={material.status} />
      ) : material.status === 'FAILED' ? (
        <MaterialFailedCard
          errorMessage={material.errorMessage}
          isRetrying={isRetrying}
          isArchived={isArchived}
          onRetry={handleRetry}
        />
      ) : material.status === 'READY' ? (
        isSplitActive ? (
          /* Side-by-Side Split View (Desktop >= 1280px) */
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Panel Kiri: Pembaca Dokumen PDF */}
            <div className="xl:col-span-6 xl:sticky xl:top-20" id="material-pdf-viewer-container">
              {pdfViewerElement}
            </div>

            {/* Panel Kanan: Fitur Pendukung Belajar */}
            <div className="xl:col-span-6 space-y-4">
              <Tabs
                value={activeTab === 'pdf' ? 'summary' : activeTab}
                onValueChange={(val) =>
                  setActiveTab(val as 'summary' | 'flashcards' | 'quiz' | 'text')
                }
                className="space-y-4"
              >
                <TabsList className="w-full justify-start h-auto p-1 bg-muted/40 border border-border rounded-xl overflow-x-auto flex-nowrap gap-1">
                  <TabsTrigger
                    value="summary"
                    className="gap-2 text-xs shrink-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs min-h-[36px]"
                  >
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span>Ringkasan AI</span>
                    {summary?.status === 'READY' && (
                      <span className="ml-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 text-xs font-semibold tabular-nums">
                        Siap
                      </span>
                    )}
                    {isAiWorking && (
                      <Loader2 className="h-3 w-3 animate-spin text-primary ml-1" />
                    )}
                  </TabsTrigger>

                  <TabsTrigger
                    value="flashcards"
                    className="gap-2 text-xs shrink-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs min-h-[36px]"
                  >
                    <Layers className="h-4 w-4 text-primary" />
                    <span>Flashcards</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="quiz"
                    className="gap-2 text-xs shrink-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs min-h-[36px]"
                  >
                    <HelpCircle className="h-4 w-4 text-primary" />
                    <span>Kuis</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="text"
                    className="gap-2 text-xs shrink-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs min-h-[36px]"
                  >
                    <BookOpen className="h-4 w-4" />
                    <span>Teks Ekstraksi</span>
                    {extractedPages.length > 0 && (
                      <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground tabular-nums">
                        {extractedPages.length} hal
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="summary" className="mt-0">
                  {summaryElement}
                </TabsContent>

                <TabsContent value="flashcards" forceMount className="mt-0">
                  {flashcardsElement}
                </TabsContent>

                <TabsContent value="quiz" forceMount className="mt-0">
                  {quizElement}
                </TabsContent>

                <TabsContent value="text" className="mt-0">
                  {textExtractionElement}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        ) : (
          /* Mode Standar / Single Panel */
          <Tabs
            value={activeTab}
            onValueChange={(val) =>
              setActiveTab(val as 'pdf' | 'summary' | 'flashcards' | 'quiz' | 'text')
            }
            className="space-y-4"
          >
            <TabsList className="w-full justify-start h-auto p-1 bg-muted/40 border border-border rounded-xl overflow-x-auto flex-nowrap gap-1">
              <TabsTrigger
                value="pdf"
                className="gap-2 text-xs shrink-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs min-h-[36px]"
              >
                <FileText className="h-4 w-4" />
                <span>Dokumen PDF</span>
              </TabsTrigger>

              <TabsTrigger
                value="summary"
                className="gap-2 text-xs shrink-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs min-h-[36px]"
              >
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Ringkasan AI</span>
                {summary?.status === 'READY' && (
                  <span className="ml-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 text-xs font-semibold tabular-nums">
                    Siap
                  </span>
                )}
                {isAiWorking && (
                  <Loader2 className="h-3 w-3 animate-spin text-primary ml-1" />
                )}
              </TabsTrigger>

              <TabsTrigger
                value="flashcards"
                className="gap-2 text-xs shrink-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs min-h-[36px]"
              >
                <Layers className="h-4 w-4 text-primary" />
                <span>Flashcards</span>
              </TabsTrigger>

              <TabsTrigger
                value="quiz"
                className="gap-2 text-xs shrink-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs min-h-[36px]"
              >
                <HelpCircle className="h-4 w-4 text-primary" />
                <span>Kuis</span>
              </TabsTrigger>

              <TabsTrigger
                value="text"
                className="gap-2 text-xs shrink-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs min-h-[36px]"
              >
                <BookOpen className="h-4 w-4" />
                <span>Teks Ekstraksi</span>
                {extractedPages.length > 0 && (
                  <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground tabular-nums">
                    {extractedPages.length} hal
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pdf" className="mt-0" id="material-pdf-viewer-container">
              {pdfViewerElement}
            </TabsContent>

            <TabsContent value="summary" className="mt-0">
              {summaryElement}
            </TabsContent>

            <TabsContent value="text" className="mt-0">
              {textExtractionElement}
            </TabsContent>

            <TabsContent value="flashcards" forceMount className="mt-0">
              {flashcardsElement}
            </TabsContent>

            <TabsContent value="quiz" forceMount className="mt-0">
              {quizElement}
            </TabsContent>
          </Tabs>
        )
      ) : null}

      {/* 3. Dialog Interaksi Khusus Materi */}
      <MaterialRegenerateSummaryDialog
        open={isRegenerateConfirmOpen}
        onOpenChange={setIsRegenerateConfirmOpen}
        dailyRemainingQuota={quota?.dailyRemaining ?? 0}
        isGenerating={isGeneratingSummary}
        onConfirmRegenerate={() => handleTriggerSummary(true)}
      />

      <MaterialEditTitleDialog
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open);
          if (open) setEditError(null);
        }}
        editTitle={editTitle}
        onEditTitleChange={setEditTitle}
        isSubmitting={isSubmittingEdit}
        editError={editError}
        onSubmit={handleUpdateTitle}
      />

      <MaterialDeleteConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        materialTitle={material.title}
        isSubmitting={isSubmittingDelete}
        deleteError={deleteError}
        onConfirmDelete={handleDelete}
      />
    </div>
  );
}
