'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AdminPaginationProps {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  currentItemsCount: number;
  itemLabel: string;
  isLoading: boolean;
  onPageChange: (nextPage: number) => void;
}

export function AdminPagination({
  page,
  limit,
  totalItems,
  totalPages,
  currentItemsCount,
  itemLabel,
  isLoading,
  onPageChange,
}: AdminPaginationProps): React.JSX.Element {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-border px-4 py-3 bg-card text-xs text-muted-foreground tabular-nums">
      <div>
        Menampilkan{' '}
        <span className="font-semibold text-foreground">
          {currentItemsCount > 0 ? (page - 1) * limit + 1 : 0}
        </span>{' '}
        hingga{' '}
        <span className="font-semibold text-foreground">
          {currentItemsCount > 0 ? Math.min(page * limit, totalItems) : 0}
        </span>{' '}
        dari{' '}
        <span className="font-semibold text-foreground">
          {totalItems.toLocaleString('id-ID')}
        </span>{' '}
        {itemLabel}
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1 || isLoading}
          className="h-8 px-2.5 gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Sebelumnya</span>
        </Button>
        <span className="px-2 font-medium text-foreground tabular-nums">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages || isLoading}
          className="h-8 px-2.5 gap-1"
        >
          <span>Berikutnya</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
