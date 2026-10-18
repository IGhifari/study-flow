import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Lucide icon component to display
   */
  icon?: LucideIcon | React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  /**
   * Primary title of the empty state
   */
  title: string;
  /**
   * Optional supporting description explaining what can be done
   */
  description?: string;
  /**
   * Optional action element, typically a Button or Link
   */
  action?: React.ReactNode;
  /**
   * Visual style variant
   * - 'dashed': standard dashed border card with subdued background (default for list/grid sections)
   * - 'plain': borderless clean layout
   */
  variant?: 'dashed' | 'plain';
  /**
   * Sizing scale
   * - 'default': standard padding (p-8 sm:p-10), h-8 icon (default)
   * - 'sm': compact padding (p-6), h-7 icon (for nested panels/cards)
   */
  size?: 'default' | 'sm';
  /**
   * Heading element to render for semantic structure
   */
  headingAs?: 'h2' | 'h3' | 'h4' | 'p';
  /**
   * Optional additional class name for the icon
   */
  iconClassName?: string;
  /**
   * Optional additional class name for the title
   */
  titleClassName?: string;
  /**
   * Optional additional class name for the description
   */
  descriptionClassName?: string;
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    {
      className,
      icon: Icon,
      title,
      description,
      action,
      variant = 'dashed',
      size = 'default',
      headingAs: Heading = 'h3',
      iconClassName,
      titleClassName,
      descriptionClassName,
      children,
      ...props
    },
    ref
  ) => {
    const isCompact = size === 'sm';

    const variantStyles = {
      dashed: cn(
        'border border-dashed border-border bg-card/40 text-center',
        isCompact ? 'rounded-lg p-6' : 'rounded-xl p-8 sm:p-10'
      ),
      plain: cn('text-center', isCompact ? 'p-6' : 'p-8 sm:p-10'),
    };

    return (
      <div
        ref={ref}
        role="status"
        aria-label={typeof title === 'string' ? title : undefined}
        className={cn(variantStyles[variant], className)}
        {...props}
      >
        {Icon && (
          <Icon
            className={cn(
              isCompact ? 'h-7 w-7' : 'h-8 w-8',
              'text-muted-foreground mx-auto',
              iconClassName
            )}
            aria-hidden="true"
          />
        )}

        <Heading
          className={cn(
            'mt-2 text-foreground',
            isCompact ? 'text-sm font-medium' : 'text-sm font-semibold',
            titleClassName
          )}
        >
          {title}
        </Heading>

        {description && (
          <p
            className={cn(
              'mt-1 text-xs text-muted-foreground max-w-sm mx-auto',
              descriptionClassName
            )}
          >
            {description}
          </p>
        )}

        {action && (
          <div className={isCompact ? 'mt-3' : 'mt-4'}>
            {action}
          </div>
        )}

        {children}
      </div>
    );
  }
);

EmptyState.displayName = 'EmptyState';

export { EmptyState };
