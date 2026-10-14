'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Pin,
  FileText,
  Edit3,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  PinOff,
} from 'lucide-react';
import { PinnedItemDetail, formatUserDateTime } from '@studyflow/shared';
import { listPinnedItems, pinMaterial, pinNote } from '@/lib/pin-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { PinnedItemsModal } from './pinned-items-modal';

interface PinnedItemsWidgetProps {
  activeSemesterId?: string | null;
  timezone?: string;
  className?: string;
}

export function PinnedItemsWidget({
  activeSemesterId,
  timezone = 'Asia/Jakarta',
  className = '',
}: PinnedItemsWidgetProps): React.JSX.Element {
  const [items, setItems] = React.useState<PinnedItemDetail[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [unpinningId, setUnpinningId] = React.useState<string | null>(null);

  // Guard against race condition on semester switches
  const fetchRequestIdRef = React.useRef(0);

  const loadPinnedItems = React.useCallback(async () => {
    const requestId = ++fetchRequestIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const data = await listPinnedItems(activeSemesterId || undefined);
      // Discard stale responses if a newer semester fetch was triggered
      if (requestId === fetchRequestIdRef.current) {
        setItems(data.items);
        setIsLoading(false);
      }
    } catch (err: any) {
      if (requestId === fetchRequestIdRef.current) {
        setError(err.message || 'Gagal memuat item yang disematkan');
        setIsLoading(false);
      }
    }
  }, [activeSemesterId]);

  React.useEffect(() => {
    loadPinnedItems();
  }, [loadPinnedItems]);

  const handleUnpin = async (item: PinnedItemDetail) => {
    setUnpinningId(item.id);
    try {
      if (item.type === 'MATERIAL') {
        await pinMaterial(item.targetId, false);
      } else {
        await pinNote(item.targetId, false);
      }
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } finally {
      setUnpinningId(null);
    }
  };

  const displayedItems = items.slice(0, 6);

  return (
    <div
      className={`rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs flex flex-col justify-between w-full ${className}`}
    >
      <div>
        {/* Header Widget */}
        <div className="flex items-center justify-between pb-3.5 border-b border-border">
          <div className="flex items-center gap-2">
            <Pin className="h-4 w-4 text-primary fill-primary" />
            <h2 className="text-base font-semibold text-foreground">Disematkan</h2>
            {items.length > 0 && (
              <Badge variant="secondary" className="text-xs ml-1 font-medium">
                {items.length}
              </Badge>
            )}
          </div>

          {items.length > 6 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className="text-xs h-7 px-2.5"
            >
              Tampilkan semua ({items.length})
            </Button>
          )}
        </div>

        {/* Content View */}
        <div className="mt-2.5">
          {isLoading ? (
            <div className="space-y-3 py-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-2">
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-7 w-14" />
                </div>
              ))}
            </div>
          ) : error ? (
            <Alert variant="destructive" className="my-2 py-3 text-xs">
              <AlertCircle className="h-4 w-4" />
              <div className="flex items-center justify-between w-full">
                <AlertDescription>{error}</AlertDescription>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadPinnedItems}
                  className="h-7 px-2 text-xs ml-2 gap-1 bg-background text-foreground"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Coba lagi</span>
                </Button>
              </div>
            </Alert>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-5 sm:py-6 text-center text-muted-foreground">
              <PinOff className="h-5 w-5 text-muted-foreground/60 mb-1.5" />
              <p className="text-sm font-medium text-foreground">
                Belum ada materi atau catatan disematkan
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
                Sematkan materi atau catatan penting agar langsung dapat diakses dari dashboard.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {displayedItems.map((item) => {
                const href =
                  item.type === 'MATERIAL'
                    ? `/materials/${item.targetId}`
                    : `/notes/${item.targetId}`;

                return (
                  <div
                    key={item.id}
                    className="py-2.5 first:pt-1 last:pb-1 flex items-start justify-between gap-2.5 group"
                  >
                    <div className="min-w-0 flex-1 pr-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-muted-foreground shrink-0">
                          {item.type === 'MATERIAL' ? (
                            <FileText className="h-3.5 w-3.5" />
                          ) : (
                            <Edit3 className="h-3.5 w-3.5" />
                          )}
                        </span>
                        <Link
                          href={href}
                          className="text-sm font-medium text-foreground hover:text-primary transition-colors block truncate"
                          title={item.title}
                        >
                          {item.title}
                        </Link>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <Badge
                          variant={item.type === 'MATERIAL' ? 'secondary' : 'outline'}
                          className="text-[10px] py-0 px-1 font-normal"
                        >
                          {item.type === 'MATERIAL' ? 'Materi' : 'Catatan'}
                        </Badge>

                        {item.isGeneralNote ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 px-1 text-muted-foreground"
                          >
                            Catatan Umum
                          </Badge>
                        ) : item.courseName ? (
                          <span className="truncate max-w-[160px] sm:max-w-[240px] font-medium text-foreground/80">
                            {item.courseName}
                          </span>
                        ) : null}

                        <span>•</span>
                        <span className="text-[11px] text-muted-foreground/80">
                          {formatUserDateTime(item.pinnedAt, timezone)}
                        </span>
                      </div>
                    </div>

                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs shrink-0 self-center"
                    >
                      <Link href={href}>
                        Buka
                        <ArrowRight className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer Link if <= 6 but has items */}
      {!isLoading && !error && items.length > 0 && items.length <= 6 && (
        <div className="mt-3 pt-2.5 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="w-full justify-between text-xs px-2 h-8 text-muted-foreground hover:text-foreground"
          >
            <span>Kelola Sematan ({items.length})</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Full Modal */}
      <PinnedItemsModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        items={items}
        onUnpinItem={handleUnpin}
        unpinningId={unpinningId}
        timezone={timezone}
      />
    </div>
  );
}
