'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type AccordionType = 'single' | 'multiple';

interface AccordionContextValue {
  type: AccordionType;
  collapsible: boolean;
  openValues: string[];
  toggleValue: (value: string) => void;
}

const AccordionContext = React.createContext<AccordionContextValue | null>(null);

interface AccordionItemContextValue {
  value: string;
  isOpen: boolean;
  triggerId: string;
  contentId: string;
}

const AccordionItemContext = React.createContext<AccordionItemContextValue | null>(null);

export interface AccordionProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: AccordionType;
  collapsible?: boolean;
  defaultValue?: string | string[];
  value?: string | string[];
  onValueChange?: (value: any) => void;
}

const Accordion = React.forwardRef<HTMLDivElement, AccordionProps>(
  (
    {
      type = 'single',
      collapsible = false,
      defaultValue,
      value,
      onValueChange,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const [internalValues, setInternalValues] = React.useState<string[]>(() => {
      if (defaultValue === undefined) return [];
      return Array.isArray(defaultValue) ? defaultValue : [defaultValue];
    });

    const isControlled = value !== undefined;
    const openValues = React.useMemo(() => {
      if (!isControlled) return internalValues;
      if (!value) return [];
      return Array.isArray(value) ? value : [value];
    }, [isControlled, value, internalValues]);

    const toggleValue = React.useCallback(
      (itemValue: string) => {
        let nextValues: string[];
        if (type === 'single') {
          const isAlreadyOpen = openValues.includes(itemValue);
          if (isAlreadyOpen) {
            nextValues = collapsible ? [] : [itemValue];
          } else {
            nextValues = [itemValue];
          }
          if (!isControlled) {
            setInternalValues(nextValues);
          }
          onValueChange?.(nextValues[0] ?? '');
        } else {
          const isAlreadyOpen = openValues.includes(itemValue);
          nextValues = isAlreadyOpen
            ? openValues.filter((v) => v !== itemValue)
            : [...openValues, itemValue];
          if (!isControlled) {
            setInternalValues(nextValues);
          }
          onValueChange?.(nextValues);
        }
      },
      [type, collapsible, openValues, isControlled, onValueChange]
    );

    return (
      <AccordionContext.Provider
        value={{ type, collapsible, openValues, toggleValue }}
      >
        <div ref={ref} className={cn('w-full', className)} {...props}>
          {children}
        </div>
      </AccordionContext.Provider>
    );
  }
);
Accordion.displayName = 'Accordion';

export interface AccordionItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

const AccordionItem = React.forwardRef<HTMLDivElement, AccordionItemProps>(
  ({ value, className, children, ...props }, ref) => {
    const context = React.useContext(AccordionContext);
    if (!context) {
      throw new Error('AccordionItem must be used within an Accordion');
    }

    const isOpen = context.openValues.includes(value);
    const triggerId = `accordion-trigger-${value}`;
    const contentId = `accordion-content-${value}`;

    return (
      <AccordionItemContext.Provider
        value={{ value, isOpen, triggerId, contentId }}
      >
        <div
          ref={ref}
          data-state={isOpen ? 'open' : 'closed'}
          className={cn('border-b border-border last:border-b-0', className)}
          {...props}
        >
          {children}
        </div>
      </AccordionItemContext.Provider>
    );
  }
);
AccordionItem.displayName = 'AccordionItem';

export interface AccordionTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const AccordionTrigger = React.forwardRef<
  HTMLButtonElement,
  AccordionTriggerProps
>(({ className, children, onClick, ...props }, ref) => {
  const accordion = React.useContext(AccordionContext);
  const item = React.useContext(AccordionItemContext);
  if (!accordion || !item) {
    throw new Error('AccordionTrigger must be used within an AccordionItem');
  }

  return (
    <h3 className="flex">
      <button
        ref={ref}
        type="button"
        id={item.triggerId}
        aria-expanded={item.isOpen}
        aria-controls={item.contentId}
        data-state={item.isOpen ? 'open' : 'closed'}
        onClick={(e) => {
          accordion.toggleValue(item.value);
          onClick?.(e);
        }}
        className={cn(
          'flex flex-1 items-center justify-between gap-4 py-4 text-left text-sm font-semibold text-foreground transition-all hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring cursor-pointer touch-manipulation [&[data-state=open]>svg]:rotate-180',
          className
        )}
        {...props}
      >
        {children}
        <ChevronDown
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
          aria-hidden="true"
        />
      </button>
    </h3>
  );
});
AccordionTrigger.displayName = 'AccordionTrigger';

export interface AccordionContentProps
  extends React.HTMLAttributes<HTMLDivElement> {}

const AccordionContent = React.forwardRef<
  HTMLDivElement,
  AccordionContentProps
>(({ className, children, ...props }, ref) => {
  const item = React.useContext(AccordionItemContext);
  if (!item) {
    throw new Error('AccordionContent must be used within an AccordionItem');
  }

  if (!item.isOpen) {
    return null;
  }

  return (
    <div
      ref={ref}
      id={item.contentId}
      role="region"
      aria-labelledby={item.triggerId}
      data-state={item.isOpen ? 'open' : 'closed'}
      className="overflow-hidden text-sm text-muted-foreground transition-all"
      {...props}
    >
      <div className={cn('pb-4 pt-0', className)}>{children}</div>
    </div>
  );
});
AccordionContent.displayName = 'AccordionContent';

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
