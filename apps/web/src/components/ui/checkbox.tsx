'use client';

import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer relative h-4.5 w-4.5 shrink-0 rounded-[5px] border border-input bg-card shadow-xs transition-all duration-200 ease-out cursor-pointer',
      'hover:border-primary/60 hover:bg-accent/40 hover:shadow-xs',
      'active:scale-95',
      'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
      'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 disabled:hover:border-input disabled:hover:bg-card',
      'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:hover:bg-primary-hover',
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn(
        'flex items-center justify-center text-current transition-all duration-200 ease-out',
        'data-[state=checked]:animate-in data-[state=checked]:zoom-in-75 data-[state=checked]:fade-in-0',
        'data-[state=unchecked]:animate-out data-[state=unchecked]:zoom-out-75 data-[state=unchecked]:fade-out-0'
      )}
    >
      <Check className="h-3.5 w-3.5 stroke-[2.75]" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
