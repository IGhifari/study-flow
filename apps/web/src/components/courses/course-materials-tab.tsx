'use client';

import * as React from 'react';
import Link from 'next/link';
import { FileUp, FileText, ExternalLink } from 'lucide-react';
import { MaterialListItem, formatFileSize, formatUserDateTime } from '@studyflow/shared';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { MaterialStatusBadge } from '@/components/materials/material-status-badge';

export interface CourseMaterialsTabProps {
  materials: MaterialListItem[];
  isLoading: boolean;
  isArchived: boolean;
  timezone: string;
  onUploadMaterial: () => void;
}

export function CourseMaterialsTab({
  materials,
  isLoading,
  isArchived,
  timezone,
  onUploadMaterial,
}: CourseMaterialsTabProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Daftar Materi PDF</h2>
          <p className="text-xs text-muted-foreground">
            File PDF perkuliahan untuk ekstraksi otomatis dan ringkasan AI.
          </p>
        </div>
        <Button
          size="standard"
          onClick={onUploadMaterial}
          disabled={isArchived}
          className="gap-1.5 shrink-0 self-start sm:self-auto"
        >
          <FileUp className="h-4 w-4" />
          <span>Unggah materi</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      ) : materials.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center sm:p-10">
          <FileUp className="h-8 w-8 text-muted-foreground mx-auto" aria-hidden="true" />
          <h3 className="mt-2 text-sm font-semibold text-foreground">
            Belum ada materi untuk mata kuliah ini
          </h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
            Unggah dokumen PDF kuliah untuk ekstraksi teks, ringkasan, flashcard, dan kuis.
          </p>
          {!isArchived && (
            <Button
              size="standard"
              variant="outline"
              onClick={onUploadMaterial}
              className="mt-4 gap-1.5"
            >
              <FileUp className="h-4 w-4" />
              <span>Unggah materi sekarang</span>
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Materials Table */}
          <Card className="hidden md:block overflow-hidden shadow-xs">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="px-4 py-3 text-xs font-semibold uppercase">
                    Judul Materi
                  </TableHead>
                  <TableHead className="px-4 py-3 text-xs font-semibold uppercase">
                    Ukuran & Halaman
                  </TableHead>
                  <TableHead className="px-4 py-3 text-xs font-semibold uppercase">
                    Status
                  </TableHead>
                  <TableHead className="px-4 py-3 text-xs font-semibold uppercase">
                    Tanggal Unggah
                  </TableHead>
                  <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="px-4 py-3 max-w-[320px]">
                      <Link
                        href={`/materials/${m.id}`}
                        className="font-medium text-foreground hover:text-primary transition-colors flex items-center gap-2 break-words"
                      >
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="break-words">{m.title}</span>
                      </Link>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 ml-6 break-words">
                        {m.originalFilename}
                      </p>
                    </TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                      <div>{formatFileSize(m.bytes)}</div>
                      {m.pageCount ? (
                        <div className="text-xs text-muted-foreground/80">
                          {m.pageCount} halaman
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap">
                      <MaterialStatusBadge status={m.status} />
                    </TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                      {formatUserDateTime(m.createdAt, timezone)}
                    </TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-right">
                      <Button asChild variant="ghost" size="sm" className="h-8 px-2.5 text-xs">
                        <Link href={`/materials/${m.id}`}>
                          Lihat
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile Materials Cards */}
          <div className="grid gap-2.5 md:hidden">
            {materials.map((m) => (
              <Card key={m.id} className="p-3.5 shadow-xs space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/materials/${m.id}`}
                    className="font-medium text-foreground hover:text-primary transition-colors text-sm line-clamp-1 flex items-center gap-1.5 break-words flex-1 min-w-0"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="break-words">{m.title}</span>
                  </Link>
                  <MaterialStatusBadge status={m.status} />
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
                  <span>
                    {formatFileSize(m.bytes)} {m.pageCount ? `• ${m.pageCount} hal` : ''}
                  </span>
                  <span>{formatUserDateTime(m.createdAt, timezone)}</span>
                </div>

                <div className="border-t border-border pt-2 flex justify-end">
                  <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                    <Link href={`/materials/${m.id}`}>
                      Lihat Materi
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
