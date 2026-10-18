'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  Columns2,
  Download,
  RotateCcw,
  Pencil,
  Trash2,
  AlertCircle,
  Loader2,
  ExternalLink,
  RefreshCw,
  MoreVertical,
  Pin,
} from 'lucide-react';
import {
  Material,
  formatUserDateTime,
} from '@studyflow/shared';
import { Button } from '@/components/ui/button';
import { MaterialStatusBadge } from '@/components/materials/material-status-badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export interface MaterialDetailHeaderProps {
  material: Material;
  isArchived: boolean;
  timezone: string;
  isSplitView: boolean;
  onToggleSplitView: () => void;
  isPinning: boolean;
  onTogglePin: () => void;
  onDownload: () => void;
  isRetrying: boolean;
  onRetry: () => void;
  onOpenEditTitle: () => void;
  onOpenDelete: () => void;
  onOpenInNewTab: () => void;
  onRefreshSignedUrl: () => void;
  actionError: string | null;
  onDismissActionError: () => void;
}

export function MaterialDetailHeader({
  material,
  isArchived,
  timezone,
  isSplitView,
  onToggleSplitView,
  isPinning,
  onTogglePin,
  onDownload,
  isRetrying,
  onRetry,
  onOpenEditTitle,
  onOpenDelete,
  onOpenInNewTab,
  onRefreshSignedUrl,
  actionError,
  onDismissActionError,
}: MaterialDetailHeaderProps): React.JSX.Element {
  const sizeMb = (material.bytes / (1024 * 1024)).toFixed(1);
  const formattedCreatedAt = formatUserDateTime(material.createdAt, timezone);

  return (
    <div className="space-y-4">
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
            onClick={onDismissActionError}
            className="h-6 px-1.5 text-xs text-destructive hover:bg-destructive/10"
          >
            Tutup
          </Button>
        </div>
      )}

      {/* 2. Header Info & Aksi */}
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
            <span className="tabular-nums">{sizeMb} MB</span>
            {material.pageCount ? (
              <>
                <span>•</span>
                <span className="font-medium text-foreground tabular-nums">{material.pageCount} hal.</span>
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
              onClick={onToggleSplitView}
              className="hidden xl:inline-flex gap-1.5 text-xs"
              title={isSplitView ? 'Fokus Satu Panel' : 'Tampilan Berdampingan'}
              aria-label={isSplitView ? 'Fokus Satu Panel' : 'Tampilan Berdampingan'}
            >
              <Columns2 className="h-4 w-4" />
              <span>{isSplitView ? 'Fokus Satu Panel' : 'Tampilan Berdampingan'}</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="standard"
            onClick={onTogglePin}
            disabled={isPinning || isArchived}
            className="gap-1.5 text-xs"
            title={material.isPinned ? 'Lepas sematan' : 'Sematkan materi ini'}
            aria-label={material.isPinned ? 'Lepas sematan' : 'Sematkan materi ini'}
          >
            {isPinning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Pin className={`h-4 w-4 ${material.isPinned ? 'fill-primary text-primary' : ''}`} />
            )}
            <span>{material.isPinned ? 'Disematkan' : 'Sematkan'}</span>
          </Button>

          {material.status === 'READY' && (
            <Button
              variant="outline"
              size="standard"
              onClick={onDownload}
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
              onClick={onRetry}
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
                onClick={onTogglePin}
                disabled={isPinning || isArchived}
                className="cursor-pointer text-xs"
              >
                <Pin className={`mr-2 h-3.5 w-3.5 ${material.isPinned ? 'fill-primary text-primary' : ''}`} />
                <span>{material.isPinned ? 'Lepas Sematan' : 'Sematkan'}</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={onOpenEditTitle}
                disabled={isArchived}
                className="cursor-pointer text-xs"
              >
                <Pencil className="mr-2 h-3.5 w-3.5" />
                <span>Edit Judul Materi</span>
              </DropdownMenuItem>

              {material.status === 'READY' && (
                <>
                  <DropdownMenuItem
                    onClick={onOpenInNewTab}
                    className="cursor-pointer text-xs"
                  >
                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                    <span>Buka di Tab Baru</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={onRefreshSignedUrl}
                    className="cursor-pointer text-xs"
                  >
                    <RefreshCw className="mr-2 h-3.5 w-3.5" />
                    <span>Perbarui Tautan Unduh</span>
                  </DropdownMenuItem>
                </>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={onOpenDelete}
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
    </div>
  );
}
