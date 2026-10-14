'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Pin,
  FileText,
  Edit3,
  ExternalLink,
  Loader2,
  AlertCircle,
  PinOff,
} from 'lucide-react';
import { PinnedItemDetail, formatUserDateTime } from '@studyflow/shared';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PinnedItemsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PinnedItemDetail[];
  onUnpinItem: (item: PinnedItemDetail) => Promise<void>;
  unpinningId: string | null;
  timezone?: string;
}

export function PinnedItemsModal({
  open,
  onOpenChange,
  items,
  onUnpinItem,
  unpinningId,
  timezone = 'Asia/Jakarta',
}: PinnedItemsModalProps): React.JSX.Element {
  const [localError, setLocalError] = React.useState<string | null>(null);

  const handleUnpin = async (item: PinnedItemDetail) => {
    setLocalError(null);
    try {
      await onUnpinItem(item);
    } catch (err: any) {
      setLocalError(err.message || 'Gagal melepas sematan item');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-5 sm:p-6 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Pin className="h-4 w-4 fill-current" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-semibold text-foreground">
                Semua Item Disematkan
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Daftar lengkap materi dan catatan penting yang Anda sematkan ({items.length} item)
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {localError && (
          <div className="px-5 pt-3">
            <Alert variant="destructive" className="py-2 text-xs">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{localError}</AlertDescription>
            </Alert>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-2.5 divide-y divide-border/60">
          {items.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <PinOff className="h-7 w-7 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">Belum ada item yang disematkan</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sematkan materi atau catatan dari halaman masing-masing.
              </p>
            </div>
          ) : (
            items.map((item) => {
              const isUnpinning = unpinningId === item.id;
              const href =
                item.type === 'MATERIAL'
                  ? `/materials/${item.targetId}`
                  : `/notes/${item.targetId}`;

              return (
                <div
                  key={item.id}
                  className="pt-2.5 first:pt-0 flex items-start justify-between gap-3 group"
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div className="mt-0.5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors">
                      {item.type === 'MATERIAL' ? (
                        <FileText className="h-4 w-4" />
                      ) : (
                        <Edit3 className="h-4 w-4" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <Link
                        href={href}
                        onClick={() => onOpenChange(false)}
                        className="text-sm font-medium text-foreground hover:text-primary transition-colors block truncate"
                        title={item.title}
                      >
                        {item.title}
                      </Link>

                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <Badge
                          variant={item.type === 'MATERIAL' ? 'secondary' : 'outline'}
                          className="text-[10px] py-0 px-1.5 font-normal"
                        >
                          {item.type === 'MATERIAL' ? 'Materi' : 'Catatan'}
                        </Badge>

                        {item.isGeneralNote ? (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-muted-foreground">
                            Catatan Umum
                          </Badge>
                        ) : item.courseName ? (
                          <span className="truncate max-w-[180px] font-medium text-foreground/80">
                            {item.courseName}
                          </span>
                        ) : null}

                        <span>•</span>
                        <span className="text-[11px]">
                          Disematkan {formatUserDateTime(item.pinnedAt, timezone)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 self-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="h-8 px-2 text-xs"
                      onClick={() => onOpenChange(false)}
                    >
                      <Link href={href}>
                        <span>Buka</span>
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnpin(item)}
                      disabled={isUnpinning}
                      className="h-8 px-2.5 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40"
                      title="Lepas sematan"
                      aria-label={`Lepas sematan untuk ${item.title}`}
                    >
                      {isUnpinning ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <PinOff className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                      )}
                      <span>Lepas</span>
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
