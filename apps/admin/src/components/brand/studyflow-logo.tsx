import * as React from 'react';
import { cn } from '@/lib/utils';

export interface StudyFlowLogoMarkProps extends React.SVGProps<SVGSVGElement> {
  framed?: boolean;
  frameClassName?: string;
}

export function StudyFlowLogoMark({
  className,
  framed = true,
  frameClassName,
  ...props
}: StudyFlowLogoMarkProps) {
  const svg = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={cn('size-6 shrink-0', className)}
      {...props}
    >
      {/* Lembaran Buku / Dokumen Terstruktur (Kiri) */}
      <path
        d="M11 19C11 17.3431 12.3431 16 14 16H28C30.2091 16 32 17.7909 32 20V46C32 44.8954 31.1046 44 30 44H14C12.3431 44 11 42.6569 11 41V19Z"
        className="fill-primary"
      />
      {/* Baris Teks Dokumen */}
      <rect x="15.5" y="21.5" width="12" height="2.6" rx="1.3" className="fill-background dark:fill-zinc-950" />
      <rect x="15.5" y="27" width="12" height="2.6" rx="1.3" className="fill-background dark:fill-zinc-950" />
      <rect x="15.5" y="32.5" width="12" height="2.6" rx="1.3" className="fill-background dark:fill-zinc-950" />
      <rect x="15.5" y="38" width="8.5" height="2.6" rx="1.3" className="fill-background dark:fill-zinc-950" />
      {/* Pita Aliran Atas Huruf 'F' */}
      <path
        d="M30 18.5C36.5 18.5 41 12.5 52 13.5C48 21.5 42.5 25.5 32 26V18.5Z"
        className="fill-primary"
      />
      {/* Pita Aliran Tengah & Batang Huruf 'F' */}
      <path
        d="M32 29.5C38.5 29.5 43 25 50 26C46.5 32.5 41.5 35 35.5 35.5V48C35.5 49.6569 34.1569 51 32.5 51H29.5V32C29.5 30.6193 30.6193 29.5 32 29.5Z"
        className="fill-foreground"
      />
    </svg>
  );

  if (!framed) return svg;

  return (
    <div
      className={cn(
        'flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-card shadow-xs',
        frameClassName
      )}
    >
      {svg}
    </div>
  );
}

export interface StudyFlowLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  subtitle?: string;
  badge?: string;
  size?: 'sm' | 'md' | 'lg';
  hideTextOnCollapsed?: boolean;
}

export function StudyFlowLogo({
  subtitle,
  badge,
  size = 'md',
  hideTextOnCollapsed = false,
  className,
  ...props
}: StudyFlowLogoProps) {
  const frameSize =
    size === 'sm' ? 'size-7 rounded-md' : size === 'lg' ? 'size-9 rounded-xl' : 'size-8 rounded-lg';
  const iconSize = size === 'sm' ? 'size-5' : size === 'lg' ? 'size-7' : 'size-6';

  return (
    <div className={cn('inline-flex items-center gap-2.5', className)} {...props}>
      <StudyFlowLogoMark frameClassName={frameSize} className={iconSize} />
      <div
        className={cn(
          'grid flex-1 text-left leading-tight',
          hideTextOnCollapsed &&
            'group-data-[collapsible=icon]:hidden group-data-[state=collapsed]:hidden'
        )}
      >
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'truncate font-semibold tracking-tight text-foreground',
              size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-lg' : 'text-[15px]'
            )}
          >
            StudyFlow
          </span>
          {badge && (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
              {badge}
            </span>
          )}
        </div>
        {subtitle && (
          <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
        )}
      </div>
    </div>
  );
}
