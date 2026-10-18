'use client';

import * as React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Copy,
  Check,
} from 'lucide-react';
import { MaterialPage } from '@studyflow/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  RadixSelect as Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

export interface MaterialExtractedTextTabProps {
  extractedPages: MaterialPage[];
  selectedPage: number;
  onSelectPage: (page: number) => void;
  copiedPageIndex: number | null;
  onCopyText: (pageNumber: number, text: string) => void;
}

export function MaterialExtractedTextTab({
  extractedPages,
  selectedPage,
  onSelectPage,
  copiedPageIndex,
  onCopyText,
}: MaterialExtractedTextTabProps): React.JSX.Element {
  const currentExtractedPage = extractedPages.find((p) => p.pageNumber === selectedPage);

  if (extractedPages.length === 0) {
    return (
      <Card className="p-8 text-center bg-card border border-border shadow-xs">
        <BookOpen className="h-8 w-8 text-muted-foreground mx-auto" />
        <h4 className="mt-2 text-sm font-semibold text-foreground">
          Teks belum diekstrak atau tidak tersedia
        </h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Dokumen ini mungkin berupa file tanpa lapisan teks atau pemrosesan ekstraksi belum selesai.
        </p>
      </Card>
    );
  }

  return (
    <Card className="border border-border p-4 sm:p-6 space-y-4 bg-card shadow-xs">
      {/* Stepper Halaman Teks */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            disabled={selectedPage <= 1}
            onClick={() => onSelectPage(Math.max(1, selectedPage - 1))}
            className="h-8 w-8 p-0"
            title="Halaman Sebelumnya"
            aria-label="Halaman Sebelumnya"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Select
            value={String(selectedPage)}
            onValueChange={(val) => onSelectPage(parseInt(val, 10))}
          >
            <SelectTrigger
              className="h-8 text-xs font-semibold min-w-[150px] w-auto gap-2"
              aria-label="Pilih nomor halaman teks"
            >
              <SelectValue placeholder="Pilih Halaman" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {extractedPages.map((p) => (
                <SelectItem key={p.pageNumber} value={String(p.pageNumber)} className="text-xs">
                  Halaman {p.pageNumber} ({p.characterCount} karakter)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon-sm"
            disabled={selectedPage >= extractedPages.length}
            onClick={() => onSelectPage(Math.min(extractedPages.length, selectedPage + 1))}
            className="h-8 w-8 p-0"
            title="Halaman Selanjutnya"
            aria-label="Halaman Selanjutnya"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium tabular-nums">
            {currentExtractedPage?.characterCount || 0} Karakter
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onCopyText(
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
  );
}
