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
  Calendar,
  AlertCircle,
  Loader2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  Info,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { MaterialFlashcardTab } from '@/components/materials/material-flashcard-tab';
import { MaterialQuizTab } from '@/components/materials/material-quiz-tab';
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

  // Delete Confirm dialog
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [isSubmittingDelete, setIsSubmittingDelete] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  // Retry document processing state
  const [isRetrying, setIsRetrying] = React.useState(false);

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
    try {
      await updateMaterial(materialId, { title: editTitle.trim() });
      await loadMaterialData();
      setIsEditOpen(false);
    } catch (err: any) {
      alert(err.message || 'Gagal memperbarui judul materi');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleDownload = async () => {
    try {
      const res = await getMaterialDownloadUrl(materialId);
      window.open(res.downloadUrl, '_blank');
    } catch (err: any) {
      alert(err.message || 'Gagal membuat tautan unduhan');
    }
  };

  const handleOpenInNewTab = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank');
    }
  };

  const handleRefreshSignedUrl = async () => {
    if (material) {
      await fetchDownloadUrl(material.id);
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await retryMaterialProcessing(materialId);
      await loadMaterialData();
    } catch (err: any) {
      alert(err.message || 'Gagal mengulang pemrosesan');
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
      // Refresh summary & quota in background
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
    setActiveTab('pdf');
    window.scrollTo({ top: 250, behavior: 'smooth' });
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
        <p className="mt-3 text-sm">Memuat dokumen materi...</p>
      </div>
    );
  }

  if (errorMessage || !material) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild className="gap-2 text-sm w-fit">
          <Link href="/materials">
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali ke Materi</span>
          </Link>
        </Button>

        <Card className="p-8 text-center bg-card">
          <AlertCircle className="h-8 w-8 text-danger mx-auto" />
          <h3 className="mt-2 text-base font-semibold text-foreground">Gagal Memuat Materi</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {errorMessage || 'Materi tidak ditemukan atau telah dihapus.'}
          </p>
          <Button asChild size="sm" className="mt-4">
            <Link href="/materials">Kembali ke Daftar Materi</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const sizeMb = (material.bytes / (1024 * 1024)).toFixed(2);
  const formattedCreatedAt = formatUserDateTime(material.createdAt, timezone);

  const extractedPages: MaterialPage[] = material.pages || [];
  const currentExtractedPage = extractedPages.find((p) => p.pageNumber === selectedTextPage);

  const isAiWorking =
    summary?.status === 'QUEUED' ||
    summary?.status === 'PROCESSING' ||
    isGeneratingSummary;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Back */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild className="gap-2 text-sm w-fit">
          <Link href="/materials">
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali ke Daftar Materi</span>
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <MaterialStatusBadge status={material.status} />
          {isArchived && (
            <span className="rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">
              Arsip
            </span>
          )}
        </div>
      </div>

      {/* Header Info */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-border pb-5">
        <div className="space-y-1.5 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
            {material.title}
          </h1>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {material.course && (
              <Link
                href={`/courses/${material.course.id}`}
                className="hover:text-primary transition-colors flex items-center gap-1 font-medium text-foreground"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>{material.course.name}</span>
              </Link>
            )}
            <span>•</span>
            <span className="truncate max-w-[200px]" title={material.originalFilename}>
              {material.originalFilename}
            </span>
            <span>•</span>
            <span>{sizeMb} MB</span>
            {material.pageCount && (
              <>
                <span>•</span>
                <span>{material.pageCount} Halaman</span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {material.status === 'READY' && (
            <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
              <Download className="h-4 w-4" />
              <span>Unduh File</span>
            </Button>
          )}

          {material.status === 'FAILED' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={isRetrying || isArchived}
              className="gap-1.5"
            >
              {isRetrying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              <span>Coba Lagi</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditOpen(true)}
            disabled={isArchived}
            className="gap-1.5"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>Edit Judul</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsDeleteOpen(true)}
            disabled={isArchived}
            className="gap-1.5 text-danger hover:bg-danger/10"
          >
            <Trash2 className="h-4 w-4" />
            <span>Hapus</span>
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {material.status === 'PROCESSING' || material.status === 'QUEUED' ? (
        <Card className="p-12 text-center bg-card">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <h3 className="mt-4 text-base font-semibold text-foreground">
            {material.status === 'QUEUED' ? 'Menunggu antrean pemrosesan' : 'Membaca dan mengekstrak isi PDF...'}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
            Dokumen sedang dianalisis dan diekstrak halamannya di worker background. Halaman akan otomatis
            diperbarui begitu proses selesai.
          </p>
        </Card>
      ) : material.status === 'FAILED' ? (
        <Card className="border-danger/30 bg-danger/5 p-8 text-center">
          <AlertCircle className="h-10 w-10 text-danger mx-auto" />
          <h3 className="mt-3 text-base font-semibold text-danger">Gagal Memproses Dokumen</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
            {material.errorMessage ||
              'Terjadi kendala saat membaca file PDF. Pastikan file tidak diproteksi kata sandi dan berisi teks yang valid.'}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRetry} disabled={isRetrying}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Coba Lagi
            </Button>
            <Button size="sm" asChild>
              <Link href="/materials">Kembali ke Daftar</Link>
            </Button>
          </div>
        </Card>
      ) : material.status === 'READY' ? (
        <div className="space-y-4">
          {/* Navigation View Tabs */}
          <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
            <Button
              variant={activeTab === 'pdf' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('pdf')}
              className="gap-2 text-xs shrink-0"
            >
              <FileText className="h-4 w-4" />
              <span>Dokumen PDF</span>
            </Button>

            <Button
              variant={activeTab === 'summary' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('summary')}
              className="gap-2 text-xs shrink-0"
            >
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span>Ringkasan AI</span>
              {summary?.status === 'READY' && (
                <span className="ml-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 text-[10px] font-semibold">
                  Siap
                </span>
              )}
              {isAiWorking && (
                <Loader2 className="h-3 w-3 animate-spin text-primary ml-1" />
              )}
            </Button>

            <Button
              variant={activeTab === 'flashcards' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('flashcards')}
              className="gap-2 text-xs shrink-0"
            >
              <Layers className="h-4 w-4 text-primary" />
              <span>Flashcards</span>
            </Button>

            <Button
              variant={activeTab === 'quiz' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('quiz')}
              className="gap-2 text-xs shrink-0"
            >
              <HelpCircle className="h-4 w-4 text-primary" />
              <span>Kuis</span>
            </Button>

            <Button
              variant={activeTab === 'text' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('text')}
              className="gap-2 text-xs shrink-0"
            >
              <BookOpen className="h-4 w-4" />
              <span>Teks Hasil Ekstraksi</span>
              {extractedPages.length > 0 && (
                <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {extractedPages.length} hal
                </span>
              )}
            </Button>
          </div>

          {/* TAB 1: Dokumen PDF */}
          {activeTab === 'pdf' && (
            <div className="space-y-3">
              {previewError ? (
                <Card className="border-warning/30 bg-warning/5 p-6 text-center">
                  <AlertCircle className="h-8 w-8 text-warning mx-auto" />
                  <h4 className="mt-2 text-sm font-semibold text-foreground">
                    Pratinjau PDF tidak dapat dimuat
                  </h4>
                  <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
                    {previewError}
                  </p>
                  <div className="mt-4 flex justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleRefreshSignedUrl}>
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      Coba Muat Ulang
                    </Button>
                    <Button size="sm" onClick={handleDownload}>
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Unduh Langsung
                    </Button>
                  </div>
                </Card>
              ) : previewUrl ? (
                <Card className="overflow-hidden border border-border bg-card">
                  {/* Interactive Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs">
                    {/* Left: Page Navigator */}
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="h-7 w-7 p-0"
                        title="Halaman Sebelumnya"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>

                      <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium px-1">
                        <span>Hal</span>
                        <input
                          type="number"
                          min={1}
                          max={totalPages}
                          value={currentPage}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val) && val >= 1 && val <= totalPages) {
                              setCurrentPage(val);
                            }
                          }}
                          className="w-12 h-6 text-center border border-border rounded bg-background text-foreground text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <span>/ {totalPages}</span>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className="h-7 w-7 p-0"
                        title="Halaman Selanjutnya"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Center: Zoom Controls */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setZoom((z) => Math.max(50, z - 10))}
                        className="h-7 w-7 p-0"
                        title="Perkecil (Zoom Out)"
                      >
                        <ZoomOut className="h-3.5 w-3.5" />
                      </Button>
                      <button
                        onClick={() => setZoom(100)}
                        className="text-muted-foreground hover:text-foreground text-xs w-12 text-center font-medium"
                        title="Reset ke 100%"
                      >
                        {zoom}%
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setZoom((z) => Math.min(200, z + 10))}
                        className="h-7 w-7 p-0"
                        title="Perbesar (Zoom In)"
                      >
                        <ZoomIn className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Right: Quick actions */}
                    <div className="flex items-center gap-1.5 ml-auto">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRefreshSignedUrl}
                        className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                        title="Perbarui Tautan yang Kedaluwarsa"
                      >
                        <RefreshCw className="h-3 w-3" />
                        <span className="hidden sm:inline">Perbarui Tautan</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleOpenInNewTab}
                        className="h-7 px-2 text-xs gap-1"
                        title="Buka di Tab Baru"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span className="hidden sm:inline">Tab Baru</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownload}
                        className="h-7 px-2 text-xs gap-1"
                      >
                        <Download className="h-3 w-3" />
                        <span>Unduh</span>
                      </Button>
                    </div>
                  </div>

                  {/* PDF Viewer Frame */}
                  <div className="relative h-[650px] sm:h-[800px] w-full bg-muted/10">
                    {isPreviewLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    )}
                    <iframe
                      key={`${previewUrl}-${currentPage}-${zoom}`}
                      src={`${previewUrl}#page=${currentPage}&zoom=${zoom}`}
                      className="h-full w-full border-none"
                      title={material.title}
                    />
                  </div>

                  {/* Footnote */}
                  <div className="border-t border-border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground flex items-center justify-between">
                    <span>
                      Pratinjau PDF interaktif resmi. Tautan unduhan dibuat secara privat dan aman.
                    </span>
                    <button
                      onClick={handleOpenInNewTab}
                      className="text-primary hover:underline font-medium text-[11px] ml-2 shrink-0"
                    >
                      Buka Layar Penuh
                    </button>
                  </div>
                </Card>
              ) : (
                <Card className="p-8 text-center bg-card">
                  <FileText className="h-8 w-8 text-muted-foreground mx-auto" />
                  <h4 className="mt-2 text-sm font-semibold text-foreground">
                    Pratinjau sedang dipersiapkan
                  </h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Klik tombol di bawah untuk meminta tautan pratinjau dokumen.
                  </p>
                  <Button size="sm" onClick={handleRefreshSignedUrl} className="mt-3">
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    Muat Pratinjau
                  </Button>
                </Card>
              )}
            </div>
          )}

          {/* TAB 2: Ringkasan AI */}
          {activeTab === 'summary' && (
            <div className="space-y-4">
              {/* Disclaimer Alert */}
              <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3.5 text-xs text-foreground">
                <Info className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-amber-600 dark:text-amber-400">
                    Informasi Kecerdasan Buatan
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    Ringkasan dihasilkan oleh AI sebagai asisten belajar pribadi. Selalu verifikasi fakta dan konsep penting dengan membaca dokumen perkuliahan asli melalui referensi halaman di bawah.
                  </p>
                </div>
              </div>

              {/* Error Alert if any */}
              {summaryError && (
                <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3 text-xs text-danger">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{summaryError}</span>
                </div>
              )}

              {/* State 1: Active In-Progress / Processing */}
              {isAiWorking ? (
                <Card className="p-12 text-center bg-card">
                  <div className="relative mx-auto w-12 h-12 flex items-center justify-center">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <Sparkles className="h-4 w-4 text-amber-500 absolute" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-foreground">
                    Menyusun Ringkasan AI...
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
                    Model AI sedang membaca seluruh teks dokumen materi dan mengekstrak konsep kunci, bagian terstruktur, serta istilah penting.
                  </p>
                  <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground font-medium">
                    <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <span>Memproses di background worker BullMQ</span>
                  </div>
                </Card>
              ) : summary?.status === 'READY' ? (
                /* State 2: Ready Summary */
                <div className="space-y-5">
                  {/* Summary Header & Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 sm:p-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-amber-500" />
                        <h2 className="text-base font-bold text-foreground">
                          {summary.title || 'Ringkasan Materi'}
                        </h2>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span>Model: {summary.model}</span>
                        <span>•</span>
                        <span>{summary.sourcePageCount} halaman dianalisis</span>
                        {quota && (
                          <>
                            <span>•</span>
                            <span className="text-primary font-medium">
                              Sisa kuota harian: {quota.dailyRemaining}/{quota.dailyLimit}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopySummary}
                        className="gap-1.5 text-xs h-8"
                      >
                        {copiedSummary ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-success" />
                            <span>Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Salin Ringkasan</span>
                          </>
                        )}
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsRegenerateConfirmOpen(true)}
                        disabled={isArchived || Boolean(quota && quota.dailyRemaining <= 0)}
                        className="gap-1.5 text-xs h-8 text-primary hover:text-primary"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>Regenerasi</span>
                      </Button>
                    </div>
                  </div>

                  {/* Overview Card */}
                  {summary.overview && (
                    <Card className="p-5 sm:p-6 bg-card space-y-2 border border-border">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Ringkasan Utama
                      </h3>
                      <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">
                        {summary.overview}
                      </p>
                    </Card>
                  )}

                  {/* Konsep Kunci */}
                  {summary.keyConcepts && (summary.keyConcepts as KeyConcept[]).length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Konsep Kunci
                      </h3>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {(summary.keyConcepts as KeyConcept[]).map((concept, idx) => (
                          <Card
                            key={idx}
                            className="p-4 bg-card border border-border flex flex-col justify-between gap-3 hover:border-primary/40 transition-colors"
                          >
                            <div className="space-y-1.5">
                              <h4 className="font-semibold text-sm text-foreground">
                                {concept.concept}
                              </h4>
                              <p className="text-xs leading-relaxed text-muted-foreground">
                                {concept.explanation}
                              </p>
                            </div>

                            {concept.pageReferences && concept.pageReferences.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/50 text-[11px]">
                                <span className="text-muted-foreground">Sumber:</span>
                                {concept.pageReferences.map((pg) => (
                                  <button
                                    key={pg}
                                    onClick={() => handleJumpToPdfPage(pg)}
                                    className="inline-flex items-center gap-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary font-medium px-1.5 py-0.5 transition-colors cursor-pointer"
                                    title={`Buka halaman ${pg} di PDF`}
                                  >
                                    <span>Hal {pg}</span>
                                    <ChevronRight className="h-3 w-3" />
                                  </button>
                                ))}
                              </div>
                            )}
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bagian Materi */}
                  {summary.sections && (summary.sections as SummarySection[]).length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Struktur & Bagian Materi
                      </h3>
                      <div className="space-y-3">
                        {(summary.sections as SummarySection[]).map((sec, idx) => (
                          <Card key={idx} className="p-4 sm:p-5 bg-card border border-border space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h4 className="font-semibold text-sm text-foreground">
                                {sec.heading}
                              </h4>
                              {sec.pageReferences && sec.pageReferences.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1">
                                  {sec.pageReferences.map((pg) => (
                                    <button
                                      key={pg}
                                      onClick={() => handleJumpToPdfPage(pg)}
                                      className="inline-flex items-center gap-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground font-medium text-[11px] px-1.5 py-0.5 transition-colors cursor-pointer"
                                      title={`Lihat Halaman ${pg}`}
                                    >
                                      <span>Hal {pg}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                              {sec.content}
                            </p>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Istilah Penting */}
                  {summary.keyTerms && (summary.keyTerms as KeyTerm[]).length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Istilah & Glosarium Penting
                      </h3>
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        {(summary.keyTerms as KeyTerm[]).map((term, idx) => (
                          <div
                            key={idx}
                            className="rounded-lg border border-border bg-card p-3 space-y-1 hover:border-primary/40 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-xs text-foreground font-mono">
                                {term.term}
                              </span>
                              {term.pageReferences && term.pageReferences.length > 0 && (
                                <div className="flex items-center gap-1">
                                  {term.pageReferences.map((pg) => (
                                    <button
                                      key={pg}
                                      onClick={() => handleJumpToPdfPage(pg)}
                                      className="text-[10px] text-primary hover:underline font-medium"
                                    >
                                      Hal {pg}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {term.definition}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Limitations if any */}
                  {summary.limitations && (
                    <div className="rounded-lg border border-border bg-muted/30 p-3.5 text-xs text-muted-foreground space-y-1">
                      <span className="font-semibold text-foreground">Catatan / Batasan:</span>
                      <p>{summary.limitations}</p>
                    </div>
                  )}
                </div>
              ) : summary?.status === 'FAILED' ? (
                /* State 3: Failed Generation */
                <Card className="border-danger/30 bg-danger/5 p-8 text-center space-y-3">
                  <AlertCircle className="h-10 w-10 text-danger mx-auto" />
                  <h3 className="text-base font-semibold text-danger">Gagal Membuat Ringkasan AI</h3>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    {summary.errorMessage ||
                      'Terjadi kesalahan saat memproses ringkasan dengan AI. Kuota harian Anda aman dan tidak terpotong untuk kegagalan sistem.'}
                  </p>
                  <div className="pt-2 flex justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTriggerSummary(false)}
                      disabled={isGeneratingSummary || Boolean(quota && quota.dailyRemaining <= 0)}
                      className="gap-1.5"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Coba Lagi</span>
                    </Button>
                  </div>
                </Card>
              ) : (
                /* State 4: Uncreated / Initial state */
                <Card className="p-8 sm:p-12 text-center bg-card border border-dashed border-border space-y-4">
                  <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Sparkles className="h-6 w-6 text-amber-500" />
                  </div>

                  <div className="space-y-1 max-w-md mx-auto">
                    <h3 className="text-base font-semibold text-foreground">
                      Ringkas Dokumen Ini dengan AI
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Dapatkan ringkasan terstruktur otomatis: konsep kunci, intisari bab perkuliahan, dan daftar istilah penting yang dapat diklik langsung menuju nomor halaman PDF aslinya.
                    </p>
                  </div>

                  {quota && (
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1 text-xs text-muted-foreground font-medium">
                      <span>Kuota Tersedia:</span>
                      <span className="text-foreground font-bold">
                        {quota.dailyRemaining} / {quota.dailyLimit}
                      </span>
                      <span>ringkasan hari ini</span>
                    </div>
                  )}

                  <div className="pt-2">
                    <Button
                      size="default"
                      onClick={() => handleTriggerSummary(false)}
                      disabled={
                        isGeneratingSummary ||
                        isArchived ||
                        Boolean(quota && quota.dailyRemaining <= 0)
                      }
                      className="gap-2 shadow-sm font-semibold"
                    >
                      {isGeneratingSummary ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Memulai Antrean...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 text-amber-300" />
                          <span>Buat Ringkasan AI Sekarang</span>
                        </>
                      )}
                    </Button>
                  </div>

                  {isArchived && (
                    <p className="text-[11px] text-warning">
                      Mata kuliah atau semester ini telah diarsipkan. Ringkasan baru tidak dapat dibuat.
                    </p>
                  )}

                  {quota && quota.dailyRemaining <= 0 && (
                    <p className="text-[11px] text-danger">
                      Batas kuota harian Anda telah habis (20 ringkasan/hari). Kuota akan direset pada 00:00 UTC.
                    </p>
                  )}
                </Card>
              )}
            </div>
          )}

          {/* TAB 3: Teks Hasil Ekstraksi */}
          {activeTab === 'text' && (
            <div className="space-y-4">
              {extractedPages.length === 0 ? (
                <Card className="p-8 text-center bg-card">
                  <BookOpen className="h-8 w-8 text-muted-foreground mx-auto" />
                  <h4 className="mt-2 text-sm font-semibold text-foreground">
                    Teks belum diekstrak atau tidak tersedia
                  </h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Dokumen ini mungkin berupa file tanpa lapisan teks atau pemrosesan ekstraksi belum selesai.
                  </p>
                </Card>
              ) : (
                <Card className="border border-border p-4 sm:p-6 space-y-4 bg-card">
                  {/* Extracted Page Stepper & Meta */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={selectedTextPage <= 1}
                        onClick={() => setSelectedTextPage((p) => Math.max(1, p - 1))}
                        className="h-8 w-8 p-0"
                        title="Halaman Sebelumnya"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>

                      <select
                        value={selectedTextPage}
                        onChange={(e) => setSelectedTextPage(parseInt(e.target.value, 10))}
                        className="h-8 rounded border border-border bg-background px-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {extractedPages.map((p) => (
                          <option key={p.pageNumber} value={p.pageNumber}>
                            Halaman {p.pageNumber} ({p.characterCount} karakter)
                          </option>
                        ))}
                      </select>

                      <Button
                        variant="outline"
                        size="sm"
                        disabled={selectedTextPage >= extractedPages.length}
                        onClick={() => setSelectedTextPage((p) => Math.min(extractedPages.length, p + 1))}
                        className="h-8 w-8 p-0"
                        title="Halaman Selanjutnya"
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
                            <Check className="h-3.5 w-3.5 text-success" />
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

                  {/* Empty text warning on mixed documents */}
                  {currentExtractedPage && currentExtractedPage.characterCount < 5 && (
                    <div className="rounded border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>
                        Halaman ini tidak mengandung teks terdeteksi. Kemungkinan halaman hanya berisi gambar, scan, atau diagram.
                      </span>
                    </div>
                  )}

                  {/* Text Content Display */}
                  <div className="rounded-lg border border-border bg-muted/20 p-4 font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap select-text max-h-[600px] overflow-y-auto">
                    {currentExtractedPage?.extractedText || (
                      <span className="text-muted-foreground italic">Tidak ada teks pada halaman ini.</span>
                    )}
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* TAB 3: Flashcards */}
          {activeTab === 'flashcards' && (
            <MaterialFlashcardTab
              materialId={material.id}
              isArchived={isArchived}
              onNavigateToPage={(pageNum) => {
                setCurrentPage(pageNum);
                setActiveTab('pdf');
              }}
            />
          )}

          {/* TAB 4: Kuis */}
          {activeTab === 'quiz' && (
            <MaterialQuizTab
              materialId={material.id}
              isArchived={isArchived}
              onNavigateToPage={(pageNum) => {
                setCurrentPage(pageNum);
                setActiveTab('pdf');
              }}
            />
          )}
        </div>
      ) : null}

      {/* Regenerate Confirmation Dialog */}
      <Dialog open={isRegenerateConfirmOpen} onOpenChange={setIsRegenerateConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerasi Ringkasan AI</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin membuat ulang ringkasan ini? Proses ini akan menggunakan 1 kuota harian Anda ({quota?.dailyRemaining ?? 0} tersisa). Ringkasan saat ini akan tetap dipertahankan sampai generasi baru selesai.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsRegenerateConfirmOpen(false)}
              disabled={isGeneratingSummary}
            >
              Batal
            </Button>
            <Button
              type="button"
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
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  <span>Ya, Regenerasi</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Title Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <form onSubmit={handleUpdateTitle}>
            <DialogHeader>
              <DialogTitle>Edit Judul Materi</DialogTitle>
              <DialogDescription>Perbarui judul dokumen materi perkuliahan ini.</DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-2">
              <Label htmlFor="edit-title">Judul Dokumen</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                disabled={isSubmittingEdit}
              />
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                disabled={isSubmittingEdit}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isSubmittingEdit || !editTitle.trim()}>
                {isSubmittingEdit ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Materi</DialogTitle>
            <DialogDescription>
              Hapus &quot;{material.title}&quot;? File dan data pemrosesan dokumen terkait akan dihapus.
              Catatan manual tetap disimpan.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <div className="mt-2 text-xs text-danger font-medium">{deleteError}</div>
          )}

          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
              disabled={isSubmittingDelete}
            >
              Batal
            </Button>
            <Button
              variant="default"
              onClick={handleDelete}
              disabled={isSubmittingDelete}
              className="bg-danger hover:bg-danger/90 text-white"
            >
              {isSubmittingDelete ? 'Menghapus...' : 'Hapus Materi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
