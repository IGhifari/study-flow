import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export function DashboardSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-4 sm:space-y-6" data-testid="dashboard-skeleton">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3.5 sm:pb-5">
        <div className="space-y-1.5 sm:space-y-2">
          <Skeleton className="h-6 w-32 sm:h-8 sm:w-44" />
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-3.5 w-36 sm:h-4 sm:w-40" />
            <Skeleton className="h-3.5 w-24 sm:h-4 sm:w-28" />
          </div>
        </div>
        <Skeleton className="h-9 w-32 sm:h-10 sm:w-36" />
      </div>

      {/* Stats Bar Skeleton: <640px 3 baris ringkas, >=640px 3 kolom kartu */}
      <div className="grid grid-cols-1 divide-y sm:divide-y-0 sm:divide-x divide-border rounded-xl border border-border bg-card shadow-xs sm:grid-cols-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-3.5 py-2.5 sm:px-5 sm:py-3.5">
          <div className="flex w-full items-center justify-between sm:w-auto sm:flex-col sm:items-start min-w-0">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-16 sm:mt-1 sm:h-7" />
            <Skeleton className="hidden sm:block mt-1 h-3 w-28" />
          </div>
          <Skeleton className="hidden sm:block h-9 w-9 rounded-lg shrink-0" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-3.5 py-2.5 sm:px-5 sm:py-3.5">
          <div className="flex w-full items-center justify-between sm:w-auto sm:flex-col sm:items-start min-w-0">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-6 w-12 sm:mt-1 sm:h-7" />
            <Skeleton className="hidden sm:block mt-1 h-3 w-32" />
          </div>
          <Skeleton className="hidden sm:block h-9 w-9 rounded-lg shrink-0" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-3.5 py-2.5 sm:px-5 sm:py-3.5">
          <div className="flex w-full items-center justify-between sm:w-auto sm:flex-col sm:items-start min-w-0">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-20 sm:mt-1 sm:h-7" />
            <Skeleton className="hidden sm:block mt-1 h-3 w-28" />
          </div>
          <Skeleton className="hidden sm:block h-9 w-9 rounded-lg shrink-0" />
        </div>
      </div>

      {/* Main & Secondary Grid Skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Left Column (2 cols) */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <div className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3.5 border-b border-border">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="divide-y divide-border/60">
              <div className="py-3.5 flex items-center justify-between">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-5 w-14 rounded-md" />
              </div>
              <div className="py-3.5 flex items-center justify-between">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-56" />
                  <Skeleton className="h-3 w-36" />
                </div>
                <Skeleton className="h-5 w-14 rounded-md" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3.5 border-b border-border">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-12" />
            </div>
            <div className="divide-y divide-border/60">
              <div className="py-3.5 flex items-center justify-between">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-52" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-5 w-14 rounded-md" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (1 col) */}
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3.5 border-b border-border">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-7 w-24 rounded-md" />
            </div>
            <div className="divide-y divide-border/60">
              <div className="py-3.5 flex items-center justify-between">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-12 rounded-md" />
              </div>
              <div className="py-3.5 flex items-center justify-between">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-6 w-12 rounded-md" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
