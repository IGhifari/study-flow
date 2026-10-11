'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  RotateCcw,
  Pencil,
  Trash2,
  FileText,
  BookOpen,
  AlertCircle,
  Loader2,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  Layers,
  HelpCircle,
  MoreVertical,
} from 'lucide-react';
import { MaterialFlashcardTab } from '@/components/materials/material-flashcard-tab';
import { MaterialQuizTab } from '@/components/materials/material-quiz-tab';
import { MaterialPdfViewer } from '@/components/materials/material-pdf-viewer';
import { MaterialSummaryTab } from '@/components/materials/material-summary-tab';
import {
  Material,
  MaterialPage,
  formatUserDateTime,
  UserProfile,
  MaterialSummary,
  AiQuotaStatus,
  KeyConcept,
  SummarySection,
  KeyTerm,
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { MaterialStatusBadge } from '@/components/materials/material-status-badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

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

  // PDF Preview & Controls State
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = React.useState(false);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [zoom, setZoom] = React.useState(100);
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
    if (!editTitle.trim()) return;
    setIsSubmittingEdit(true);
    setEditError(null);
    try {
      await updateMaterial(materialId, { title: editTitle.trim() });
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

  const handleJumpToPdfPage = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    setHighlightedPage(pageNumber);
    setActiveTab('pdf');
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

  const isArchived = Boolean(
    material?.course?.archivedAt || material?.course?.semester?.archivedAt
  );

  const totalPages = material?.pageCount || material?.pages?.length || 1;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-3 text-sm font-medium">Memuat materi kuliah...</p>
      </div>
    );
  }

  if (errorMessage || !material) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="standard" asChild className="gap-2 text-xs w-fit">
          <Link href="/materials">
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali ke Materi</span>
          </Link>
        </Button>

        <Card className="p-8 sm:p-12 text-center bg-card border border-border shadow-xs">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
          <h3 className="mt-3 text-base font-semibold text-foreground">Gagal Memuat Materi</h3>
          <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
            {errorMessage || 'Materi tidak ditemukan atau telah dihapus.'}
          </p>
          <Button asChild size="standard" className="mt-5">
            <Link href="/materials">Kembali ke Daftar Materi</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const sizeMb = (material.bytes / (1024 * 1024)).toFixed(1);
  const formattedCreatedAt = formatUserDateTime(material.createdAt, timezone);
  const extractedPages: MaterialPage[] = material.pages || [];
  const currentExtractedPage = extractedPages.find((p) => p.pageNumber === selectedTextPage);

  const isAiWorking =
    summary?.status === 'QUEUED' ||
    summary?.status === 'PROCESSING' ||
    isGeneratingSummary;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* 1. Navigasi Kembali & Breadcrumb Ringkas */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="h-8 px-2 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Link href="/materials">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Kembali ke Materi</span>
            </Link>
          </Button>

          {material.course && (
            <>
              <span className="text-muted-foreground/40">•</span>
              <Link
                href={`/courses/${material.course.id}`}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors max-w-[160px] truncate flex items-center gap-1 font-medium"
                title={material.course.name}
              >
                <BookOpen className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{material.course.name}</span>
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <MaterialStatusBadge
            status={material.status}
            errorCode={material.errorCode}
            errorMessage={material.errorMessage}
          />
          {isArchived && (
            <span className="rounded-md bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
              Arsip
            </span>
          )}
        </div>
      </div>

      {/* Action Error Banner */}
      {actionError && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActionError(null)}
            className="h-6 px-1.5 text-[11px] text-destructive hover:bg-destructive/10"
          >
            Tutup
          </Button>
        </div>
      )}

      {/* 2. Header Detail Materi */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-border pb-4 sm:pb-5">
        <div className="space-y-1.5 min-w-0 flex-1 pr-0 sm:pr-4">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground break-words">
            {material.title}
          </h1>

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
            <span className="truncate max-w-[220px]" title={material.originalFilename}>
              {material.originalFilename}
            </span>
            <span>•</span>
            <span>{sizeMb} MB</span>
            {material.pageCount ? (
              <>
                <span>•</span>
                <span className="font-medium text-foreground">{material.pageCount} hal.</span>
              </>
            ) : null}
            <span>•</span>
            <span>{formattedCreatedAt}</span>
          </div>
        </div>

        {/* Aksi Utama & Dropdown Aksi Sekunder */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          {material.status === 'READY' && (
            <Button
              variant="outline"
              size="standard"
              onClick={handleDownload}
              className="gap-1.5 text-xs"
            >
              <Download className="h-4 w-4" />
              <span>Unduh Berkas</span>
            </Button>
          )}

          {material.status === 'FAILED' && (
            <Button
              variant="outline"
              size="standard"
              onClick={handleRetry}
              disabled={isRetrying || isArchived}
              className="gap-1.5 text-xs"
            >
              {isRetrying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              <span>Coba Lagi</span>
            </Button>
          )}

          {/* Menu Dropdown Aksi Sekunder */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                aria-label="Pilihan aksi materi lainnya"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onClick={() => setIsEditOpen(true)}
                disabled={isArchived}
                className="cursor-pointer text-xs"
              >
                <Pencil className="mr-2 h-3.5 w-3.5" />
                <span>Edit Judul Materi</span>
              </DropdownMenuItem>

              {material.status === 'READY' && (
                <>
                  <DropdownMenuItem
                    onClick={handleOpenInNewTab}
                    className="cursor-pointer text-xs"
                  >
                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                    <span>Buka di Tab Baru</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleRefreshSignedUrl}
                    className="cursor-pointer text-xs"
                  >
                    <RefreshCw className="mr-2 h-3.5 w-3.5" />
                    <span>Perbarui Tautan Unduh</span>
                  </DropdownMenuItem>
                </>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => setIsDeleteOpen(true)}
                disabled={isArchived}
                className="cursor-pointer text-xs text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                <span>Hapus Materi</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 3. Status Khusus Dokumen Antrean / Pemrosesan */}
      {material.status === 'PROCESSING' || material.status === 'QUEUED' ? (
        <Card className="p-10 sm:p-14 text-center bg-card border border-border shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">
            {material.status === 'QUEUED'
              ? 'Menunggu antrean pemrosesan'
              : 'Membaca dan mengekstrak isi PDF...'}
          </h3>
          <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Dokumen sedang dianalisis dan diekstrak teks halamannya di worker background. Halaman akan otomatis diperbarui begitu proses selesai.
          </p>
        </Card>
      ) : material.status === 'FAILED' ? (
        <Card className="border-destructive/30 bg-destructive/5 p-8 sm:p-10 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-base font-semibold text-destructive">Gagal Memproses Dokumen</h3>
          <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            {material.errorMessage ||
              'Terjadi kendala saat membaca berkas PDF. Pastikan file berbasis teks yang valid dan tidak diproteksi password.'}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button
              variant="outline"
              size="standard"
              onClick={handleRetry}
              disabled={isRetrying || isArchived}
              className="gap-1.5 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Coba Lagi</span>
            </Button>
            <Button variant="default" size="standard" asChild className="text-xs">
              <Link href="/materials">Kembali ke Daftar</Link>
            </Button>
          </div>
        </Card>
      ) : material.status === 'READY' ? (
        /* 4. Tab Navigasi Konten Utama */
        <Tabs
          value={activeTab}
          onValueChange={(val) =>
            setActiveTab(val as 'pdf' | 'summary' | 'flashcards' | 'quiz' | 'text')
          }
          className="space-y-4"
        >
          {/* List Tab Navigasi */}
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
                <span className="ml-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 text-[10px] font-semibold">
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
                <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {extractedPages.length} hal
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Pembaca PDF Interaktif */}
          <TabsContent value="pdf" className="mt-0" id="material-pdf-viewer-container">
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
            />
          </TabsContent>

          {/* TAB 2: Ringkasan AI */}
          <TabsContent value="summary" className="mt-0">
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
          </TabsContent>

          {/* TAB 3: Teks Hasil Ekstraksi */}
          <TabsContent value="text" className="mt-0 space-y-4">
            {extractedPages.length === 0 ? (
              <Card className="p-8 text-center bg-card border border-border shadow-xs">
                <BookOpen className="h-8 w-8 text-muted-foreground mx-auto" />
                <h4 className="mt-2 text-sm font-semibold text-foreground">
                  Teks belum diekstrak atau tidak tersedia
                </h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Dokumen ini mungkin berupa file tanpa lapisan teks atau pemrosesan ekstraksi belum selesai.
                </p>
              </Card>
            ) : (
              <Card className="border border-border p-4 sm:p-6 space-y-4 bg-card shadow-xs">
                {/* Stepper Halaman Teks */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      disabled={selectedTextPage <= 1}
                      onClick={() => setSelectedTextPage((p) => Math.max(1, p - 1))}
                      className="h-8 w-8 p-0"
                      title="Halaman Sebelumnya"
                      aria-label="Halaman Sebelumnya"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <select
                      value={selectedTextPage}
                      onChange={(e) => setSelectedTextPage(parseInt(e.target.value, 10))}
                      className="h-8 rounded-lg border border-input bg-background px-2 text-xs font-semibold text-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary"
                      aria-label="Pilih nomor halaman teks"
                    >
                      {extractedPages.map((p) => (
                        <option key={p.pageNumber} value={p.pageNumber}>
                          Halaman {p.pageNumber} ({p.characterCount} karakter)
                        </option>
                      ))}
                    </select>

                    <Button
                      variant="outline"
                      size="icon-sm"
                      disabled={selectedTextPage >= extractedPages.length}
                      onClick={() => setSelectedTextPage((p) => Math.min(extractedPages.length, p + 1))}
                      className="h-8 w-8 p-0"
                      title="Halaman Selanjutnya"
                      aria-label="Halaman Selanjutnya"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-medium">
                      {currentExtractedPage?.characterCount || 0} Karakter
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleCopyText(
                          currentExtractedPage?.pageNumber || 1,
                          currentExtractedPage?.extractedText || ''
                        )
                      }
                      className="h-8 gap-1.5 text-xs"
                    >
                      {copiedPageIndex === currentExtractedPage?.pageNumber ? (
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
                  </div>
                </div>

                {/* Teks Isi */}
                <div className="rounded-lg border border-border bg-muted/20 p-4 font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap select-text max-h-[600px] overflow-y-auto">
                  {currentExtractedPage?.extractedText || (
                    <span className="text-muted-foreground italic">
                      Tidak ada teks pada halaman ini.
                    </span>
                  )}
                </div>
              </Card>
            )}
          </TabsContent>

          {/* TAB 4: Flashcards */}
          <TabsContent value="flashcards" forceMount className="mt-0">
            <MaterialFlashcardTab
              materialId={material.id}
              isArchived={isArchived}
              onNavigateToPage={handleJumpToPdfPage}
            />
          </TabsContent>

          {/* TAB 5: Kuis */}
          <TabsContent value="quiz" forceMount className="mt-0">
            <MaterialQuizTab
              materialId={material.id}
              isArchived={isArchived}
              onNavigateToPage={handleJumpToPdfPage}
            />
          </TabsContent>
        </Tabs>
      ) : null}

      {/* Dialog Konfirmasi Regenerasi Ringkasan */}
      <Dialog open={isRegenerateConfirmOpen} onOpenChange={setIsRegenerateConfirmOpen}>
        <DialogContent className="sm:max-w-[420px] p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Regenerasi Ringkasan AI
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1.5">
              Apakah kamu ingin membuat ulang ringkasan ini? Tindakan ini akan memakai 1 kuota harian ({quota?.dailyRemaining ?? 0} tersisa). Ringkasan saat ini tetap disimpan sampai proses selesai.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-5 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="standard"
              onClick={() => setIsRegenerateConfirmOpen(false)}
              disabled={isGeneratingSummary}
            >
              Batal
            </Button>
            <Button
              type="button"
              size="standard"
              onClick={() => handleTriggerSummary(true)}
              disabled={isGeneratingSummary}
              className="gap-2"
            >
              {isGeneratingSummary ? (
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

      {/* Dialog Edit Judul Materi */}
      <Dialog
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open);
          if (open) setEditError(null);
        }}
      >
        <DialogContent className="sm:max-w-[420px] p-5 sm:p-6">
          <form onSubmit={handleUpdateTitle}>
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
                onChange={(e) => setEditTitle(e.target.value)}
                disabled={isSubmittingEdit}
                required
                className="h-9 text-xs sm:text-sm"
              />
            </div>

            <DialogFooter className="mt-5 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="standard"
                onClick={() => setIsEditOpen(false)}
                disabled={isSubmittingEdit}
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="standard"
                disabled={isSubmittingEdit || !editTitle.trim()}
              >
                {isSubmittingEdit ? (
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

      {/* Dialog Konfirmasi Hapus Materi */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-[420px] p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Hapus Materi Kuliah?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1.5">
              Materi <span className="font-semibold text-foreground">&ldquo;{material.title}&rdquo;</span>{' '}
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
              onClick={() => setIsDeleteOpen(false)}
              disabled={isSubmittingDelete}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="standard"
              onClick={handleDelete}
              disabled={isSubmittingDelete}
            >
              {isSubmittingDelete ? (
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
    </div>
  );
}
