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
} from 'lucide-react';
import {
  Material,
  MaterialPage,
  formatUserDateTime,
  UserProfile,
} from '@studyflow/shared';
import {
  getMaterial,
  updateMaterial,
  deleteMaterial,
  retryMaterialProcessing,
  getMaterialDownloadUrl,
} from '@/lib/material-client';
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

  // Tab View Mode: 'pdf' or 'text'
  const [activeTab, setActiveTab] = React.useState<'pdf' | 'text'>('pdf');

  // PDF Preview & Controls State
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = React.useState(false);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [zoom, setZoom] = React.useState(100);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [copiedPageIndex, setCopiedPageIndex] = React.useState<number | null>(null);

  // Extracted text page selection
  const [selectedTextPage, setSelectedTextPage] = React.useState(1);

  // Edit Title dialog
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = React.useState(false);

  // Delete Confirm dialog
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [isSubmittingDelete, setIsSubmittingDelete] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  // Retry state
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
        await fetchDownloadUrl(mat.id);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memuat detail materi');
    } finally {
      setIsLoading(false);
    }
  }, [materialId, fetchDownloadUrl]);

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
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 4000);

    return () => clearInterval(timer);
  }, [material, fetchDownloadUrl]);

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

        <Card className="border-danger/30 bg-danger/5 p-8 text-center">
          <AlertCircle className="h-10 w-10 text-danger mx-auto" />
          <h2 className="mt-3 text-base font-semibold text-foreground">
            {errorMessage || 'Materi tidak ditemukan'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Dokumen mungkin telah dihapus atau Anda tidak memiliki akses ke materi ini.
          </p>
          <Button asChild className="mt-4">
            <Link href="/materials">Lihat Semua Materi</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const sizeMb = (material.bytes / (1024 * 1024)).toFixed(1);
  const extractedPages: MaterialPage[] = material.pages || [];
  const currentExtractedPage =
    extractedPages.find((p) => p.pageNumber === selectedTextPage) || extractedPages[0];

  return (
    <div className="space-y-6">
      {/* Top Header & Navigation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 min-w-0">
          <Button variant="ghost" asChild className="gap-1.5 text-xs h-7 px-2 -ml-2 text-muted-foreground">
            <Link href="/materials">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Semua Materi</span>
            </Link>
          </Button>

          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate max-w-xl">
              {material.title}
            </h1>
            <MaterialStatusBadge
              status={material.status}
              errorCode={material.errorCode}
              errorMessage={material.errorMessage}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-muted-foreground mt-1">
            {material.course && (
              <Link
                href={`/courses/${material.course.id}`}
                className="hover:text-foreground flex items-center gap-1 font-medium"
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
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Button
              variant={activeTab === 'pdf' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('pdf')}
              className="gap-2 text-xs"
            >
              <FileText className="h-4 w-4" />
              <span>Dokumen PDF</span>
            </Button>

            <Button
              variant={activeTab === 'text' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('text')}
              className="gap-2 text-xs"
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

                  {/* Mobile Helper Footnote */}
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

          {/* TAB 2: Teks Hasil Ekstraksi */}
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
        </div>
      ) : null}

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
