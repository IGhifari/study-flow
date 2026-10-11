'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  onValueChange: (value: string) => void;
}

export function Tabs({
  value,
  onValueChange,
  className,
  children,
  ...props
}: TabsProps): React.JSX.Element {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn('w-full', className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {}

export function TabsList({ className, children, ...props }: TabsListProps): React.JSX.Element {
  const listRef = React.useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!listRef.current) return;
    const tabs = Array.from(
      listRef.current.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])')
    );
    const currentIndex = tabs.findIndex((t) => t === document.activeElement);

    if (currentIndex === -1) return;

    let targetIndex = currentIndex;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      targetIndex = (currentIndex + 1) % tabs.length;
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      targetIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      e.preventDefault();
    } else if (e.key === 'Home') {
      targetIndex = 0;
      e.preventDefault();
    } else if (e.key === 'End') {
      targetIndex = tabs.length - 1;
      e.preventDefault();
    }

    if (targetIndex !== currentIndex && tabs[targetIndex]) {
      tabs[targetIndex]!.focus();
      tabs[targetIndex]!.click();
    }
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      onKeyDown={handleKeyDown}
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export function TabsTrigger({
  value,
  className,
  children,
  disabled,
  ...props
}: TabsTriggerProps): React.JSX.Element {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error('TabsTrigger must be used within Tabs');
  }

  const isSelected = context.value === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isSelected}
      tabIndex={isSelected ? 0 : -1}
      disabled={disabled}
      onClick={() => context.onValueChange(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
        isSelected
          ? 'bg-background text-foreground shadow-xs font-semibold'
          : 'text-muted-foreground hover:text-foreground',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  forceMount?: boolean;
}

export function TabsContent({
  value,
  forceMount,
  className,
  children,
  ...props
}: TabsContentProps): React.JSX.Element | null {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error('TabsContent must be used within Tabs');
  }

  const isSelected = context.value === value;
  if (!isSelected && !forceMount) {
    return null;
  }

  return (
    <div
      role="tabpanel"
      tabIndex={0}
      hidden={!isSelected}
      className={cn(
        'mt-2 ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        !isSelected && 'hidden',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
