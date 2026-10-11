'use client';

import * as React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Download,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Loader2,
  FileText,
  Maximize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface MaterialPdfViewerProps {
  materialTitle: string;
  previewUrl: string | null;
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  isLoading: boolean;
  error: string | null;
  onRefreshSignedUrl: () => void;
  onDownload: () => void;
  highlightedPage?: number | null;
}

export function MaterialPdfViewer({
  materialTitle,
  previewUrl,
  totalPages,
  currentPage,
  onPageChange,
  zoom,
  onZoomChange,
  isLoading,
  error,
  onRefreshSignedUrl,
  onDownload,
  highlightedPage,
}: MaterialPdfViewerProps): React.JSX.Element {
  const [pageInput, setPageInput] = React.useState<string>(String(currentPage));

  React.useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const handlePageInputCommit = () => {
    const val = parseInt(pageInput, 10);
    if (!isNaN(val) && val >= 1 && val <= totalPages) {
      onPageChange(val);
    } else {
      setPageInput(String(currentPage));
    }
  };

  const handleOpenInNewTab = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (error) {
    return (
      <Card className="border border-border/80 bg-card p-6 sm:p-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h4 className="mt-3 text-base font-semibold text-foreground">
          Pratinjau Dokumen Belum Dapat Ditampilkan
        </h4>
        <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          {error}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          <Button
            variant="outline"
            size="standard"
            onClick={onRefreshSignedUrl}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Muat Ulang Tautan</span>
          </Button>
          <Button
            variant="default"
            size="standard"
            onClick={onDownload}
            className="gap-1.5 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Unduh Berkas Langsung</span>
          </Button>
        </div>
      </Card>
    );
  }

  if (!previewUrl && !isLoading) {
    return (
      <Card className="border border-dashed border-border bg-card/60 p-8 sm:p-12 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <FileText className="h-5 w-5" />
        </div>
        <h4 className="mt-3 text-sm font-semibold text-foreground">
          Pratinjau Dokumen Sedang Dipersiapkan
        </h4>
        <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
          Klik tombol di bawah untuk memuat tautan pratinjau dokumen PDF yang aman.
        </p>
        <Button
          variant="outline"
          size="standard"
          onClick={onRefreshSignedUrl}
          className="mt-4 gap-1.5 text-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Muat Pratinjau</span>
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-2.5">
      {/* Banner informasi saat melompat ke halaman sumber */}
      {highlightedPage && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3.5 py-2 text-xs text-primary animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-primary" />
            <span>
              Menampilkan sumber rujukan: <strong>Halaman {highlightedPage}</strong>
            </span>
          </div>
          <button
            onClick={() => onPageChange(highlightedPage)}
            className="text-[11px] underline hover:opacity-80 font-medium"
          >
            Fokus halaman
          </button>
        </div>
      )}

      {/* Frame Reader Utama */}
      <Card className="overflow-hidden border border-border bg-card shadow-xs">
        {/* Toolbar Kontrol Pembaca */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2 text-xs">
          {/* Sisi Kiri: Navigasi Halaman */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={currentPage <= 1 || isLoading}
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Halaman Sebelumnya"
              aria-label="Halaman Sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1.5 px-1 font-medium text-muted-foreground text-xs">
              <span className="hidden sm:inline">Hal</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onBlur={handlePageInputCommit}
                onKeyDown={(e) => e.key === 'Enter' && handlePageInputCommit()}
                className="w-12 h-7 text-center rounded-md border border-input bg-background text-foreground text-xs font-semibold focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary"
                aria-label="Nomor halaman PDF saat ini"
              />
              <span>/ {totalPages}</span>
            </div>

            <Button
              variant="ghost"
              size="icon-sm"
              disabled={currentPage >= totalPages || isLoading}
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Halaman Selanjutnya"
              aria-label="Halaman Selanjutnya"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Sisi Tengah: Kontrol Pembesaran (Zoom) */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onZoomChange(Math.max(50, zoom - 15))}
              disabled={zoom <= 50 || isLoading}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Perkecil Tampilan"
              aria-label="Perkecil Zoom"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>

            <button
              type="button"
              onClick={() => onZoomChange(100)}
              className="h-7 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-accent"
              title="Kembalikan ke 100%"
              aria-label="Reset zoom ke 100%"
            >
              {zoom}%
            </button>

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onZoomChange(Math.min(200, zoom + 15))}
              disabled={zoom >= 200 || isLoading}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Perbesar Tampilan"
              aria-label="Perbesar Zoom"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Sisi Kanan: Quick Actions */}
          <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefreshSignedUrl}
              className="h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
              title="Perbarui tautan jika kedaluwarsa"
              aria-label="Perbarui tautan dokumen"
            >
              <RefreshCw className="h-3 w-3" />
              <span className="hidden sm:inline">Perbarui</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenInNewTab}
              className="h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
              title="Buka dokumen di tab baru browser"
              aria-label="Buka dokumen di tab baru"
            >
              <ExternalLink className="h-3 w-3" />
              <span className="hidden sm:inline">Tab Baru</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onDownload}
              className="h-8 px-2.5 text-xs gap-1.5"
              aria-label="Unduh berkas asli"
            >
              <Download className="h-3 w-3" />
              <span>Unduh</span>
            </Button>
          </div>
        </div>

        {/* Viewport Iframe PDF */}
        <div className="relative h-[620px] sm:h-[800px] lg:h-[860px] w-full bg-muted/15">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-xs z-10 gap-2">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <span className="text-xs font-medium text-muted-foreground">
                Memuat pratinjau halaman...
              </span>
            </div>
          )}

          {previewUrl && (
            <iframe
              key={`${previewUrl}-${currentPage}-${zoom}`}
              src={`${previewUrl}#page=${currentPage}&zoom=${zoom}`}
              className="h-full w-full border-none"
              title={`Pratinjau PDF: ${materialTitle}`}
            />
          )}
        </div>

        {/* Footer Ringkas */}
        <div className="flex items-center justify-between border-t border-border bg-muted/20 px-3.5 py-2 text-[11px] text-muted-foreground">
          <span className="truncate max-w-[280px] sm:max-w-none">
            Pratinjau dokumen PDF terenkripsi aman.
          </span>
          <button
            type="button"
            onClick={handleOpenInNewTab}
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline shrink-0 ml-2"
          >
            <Maximize2 className="h-3 w-3" />
            <span>Layar Penuh</span>
          </button>
        </div>
      </Card>
    </div>
  );
}
