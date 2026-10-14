import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'standard' | 'sm' | 'lg' | 'icon' | 'icon-sm';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    const variantStyles = {
      default: 'bg-primary text-primary-foreground hover:bg-primary-hover shadow-xs',
      destructive: 'bg-destructive text-destructive-foreground hover:opacity-90 shadow-xs',
      outline: 'border border-border bg-card hover:bg-accent hover:text-accent-foreground',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      ghost: 'hover:bg-accent hover:text-accent-foreground',
      link: 'text-primary underline-offset-4 hover:underline',
    };

    const sizeStyles = {
      default: 'h-11 px-4 py-2 text-sm rounded-lg min-h-[44px]',
      standard: 'h-9 px-3.5 py-1.5 text-sm rounded-lg min-h-[36px]',
      sm: 'h-8 rounded-md px-2.5 py-1 text-xs min-h-[32px]',
      lg: 'h-11 rounded-lg px-6 text-sm min-h-[44px]',
      icon: 'h-9 w-9 rounded-lg p-0',
      'icon-sm': 'h-8 w-8 rounded-md p-0',
    };

    return (
      <Comp
        className={cn(
          'inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 touch-manipulation',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
