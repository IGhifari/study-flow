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
  Minimize2,
  Columns2,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export type PdfZoomMode = number | 'fit-width' | 'fit-page';

interface MaterialPdfViewerProps {
  materialTitle: string;
  previewUrl: string | null;
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  zoom: PdfZoomMode;
  onZoomChange: (zoom: PdfZoomMode) => void;
  isLoading: boolean;
  error: string | null;
  onRefreshSignedUrl: () => void;
  onDownload: () => void;
  highlightedPage?: number | null;
  isSplitView?: boolean;
  onToggleSplitView?: () => void;
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
  isSplitView,
  onToggleSplitView,
}: MaterialPdfViewerProps): React.JSX.Element {
  const [pageInput, setPageInput] = React.useState<string>(String(currentPage));

  React.useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {
          handleOpenInNewTab();
        });
      } else {
        handleOpenInNewTab();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

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

  const pdfFragment = React.useMemo(() => {
    if (zoom === 'fit-width') {
      return `#page=${currentPage}&view=FitH`;
    }
    if (zoom === 'fit-page') {
      return `#page=${currentPage}&view=Fit`;
    }
    return `#page=${currentPage}&zoom=${zoom}`;
  }, [currentPage, zoom]);

  const handleZoomIn = () => {
    if (typeof zoom === 'number') {
      onZoomChange(Math.min(250, zoom + 15));
    } else {
      onZoomChange(125);
    }
  };

  const handleZoomOut = () => {
    if (typeof zoom === 'number') {
      onZoomChange(Math.max(50, zoom - 15));
    } else {
      onZoomChange(75);
    }
  };

  const zoomLabel =
    zoom === 'fit-width'
      ? 'Pas Lebar'
      : zoom === 'fit-page'
        ? 'Pas Halaman'
        : `${zoom}%`;

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
            className="text-xs underline hover:opacity-80 font-medium"
          >
            Fokus halaman
          </button>
        </div>
      )}

      {/* Frame Reader Utama */}
      <Card
        ref={containerRef}
        className={cn(
          "overflow-hidden border border-border bg-card shadow-xs transition-all",
          isFullscreen && "fixed inset-0 z-50 rounded-none border-none h-screen w-screen flex flex-col bg-background"
        )}
      >
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
                className="w-12 h-7 text-center rounded-md border border-input bg-background text-foreground text-xs font-semibold focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary tabular-nums"
                aria-label="Nomor halaman PDF saat ini"
              />
              <span className="tabular-nums">/ {totalPages}</span>
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
              onClick={handleZoomOut}
              disabled={zoom === 50 || isLoading}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Perkecil Tampilan"
              aria-label="Perkecil Zoom"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="h-7 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-accent flex items-center gap-1"
                  title="Pilih skala tampilan"
                  aria-label="Pilih skala zoom dokumen"
                >
                  <span className="tabular-nums">{zoomLabel}</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-36 text-xs">
                <DropdownMenuItem onClick={() => onZoomChange('fit-width')}>
                  <span className={zoom === 'fit-width' ? 'font-bold text-primary' : ''}>
                    Pas Lebar (Fit)
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onZoomChange('fit-page')}>
                  <span className={zoom === 'fit-page' ? 'font-bold text-primary' : ''}>
                    Pas Halaman
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {[50, 75, 100, 125, 150, 200].map((val) => (
                  <DropdownMenuItem key={val} onClick={() => onZoomChange(val)}>
                    <span className={zoom === val ? 'font-bold text-primary tabular-nums' : 'tabular-nums'}>
                      {val}% {val === 100 ? '(Asli)' : ''}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleZoomIn}
              disabled={zoom === 250 || isLoading}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Perbesar Tampilan"
              aria-label="Perbesar Zoom"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Sisi Kanan: Quick Actions & Tampilan Penuh */}
          <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
            {onToggleSplitView && (
              <Button
                variant={isSplitView ? "outline" : "secondary"}
                size="sm"
                onClick={onToggleSplitView}
                className="h-8 px-2 text-xs gap-1 hidden xl:inline-flex"
                title={isSplitView ? "Perluas tampilan PDF tanpa panel kanan" : "Kembali ke tampilan belajar berdampingan"}
                aria-label={isSplitView ? "Perluas tampilan PDF tanpa panel kanan" : "Kembali ke tampilan belajar berdampingan"}
              >
                <Columns2 className="h-3.5 w-3.5" />
                <span>{isSplitView ? "Panel Penuh" : "Bagi Layar"}</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleFullscreen}
              className="h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
              title={isFullscreen ? "Keluar dari layar penuh monitor" : "Tampilkan PDF di seluruh layar monitor"}
              aria-label={isFullscreen ? "Keluar dari layar penuh" : "Mode layar penuh"}
            >
              {isFullscreen ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {isFullscreen ? "Keluar Penuh" : "Layar Penuh"}
              </span>
            </Button>

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
        <div
          className={cn(
            "relative w-full bg-muted/15 flex-1 transition-all",
            isFullscreen ? "h-[calc(100vh-84px)]" : "h-[620px] sm:h-[800px] lg:h-[860px]"
          )}
        >
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
              src={`${previewUrl}${pdfFragment}`}
              className="h-full w-full border-none"
              title={`Pratinjau PDF: ${materialTitle}`}
            />
          )}
        </div>

        {/* Footer Ringkas */}
        <div className="flex items-center justify-between border-t border-border bg-muted/20 px-3.5 py-2 text-xs text-muted-foreground">
          <span className="truncate max-w-[280px] sm:max-w-none">
            Pratinjau dokumen PDF terenkripsi aman.
          </span>
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline shrink-0 ml-2"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="h-3 w-3" />
                <span>Keluar Layar Penuh</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-3 w-3" />
                <span>Layar Penuh</span>
              </>
            )}
          </button>
        </div>
      </Card>
    </div>
  );
}
