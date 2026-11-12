import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'danger' | 'destructive';
}

function Badge({
  className,
  variant = 'default',
  ...props
}: BadgeProps): React.JSX.Element {
  const variantStyles = {
    default: 'bg-primary text-primary-foreground border-transparent',
    secondary: 'bg-secondary text-secondary-foreground border-transparent',
    outline: 'border-border text-foreground',
    success: 'bg-success text-success-foreground border-transparent',
    warning: 'bg-warning text-warning-foreground border-transparent',
    danger: 'bg-danger text-danger-foreground border-transparent',
    destructive: 'bg-danger text-danger-foreground border-transparent',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors',
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
