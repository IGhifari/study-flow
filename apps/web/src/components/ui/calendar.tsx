'use client';

import * as React from 'react';
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from 'lucide-react';
import { DayButton, DayPicker, getDefaultClassNames } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = 'label',
  formatters,
  components,
  ...props
}: CalendarProps) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        'bg-card group/calendar p-3 [--cell-size:2.25rem] select-none',
        className
      )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString(props.locale?.code ?? 'default', { month: 'short' }),
        ...formatters,
      }}
      classNames={{
        root: cn('w-fit', defaultClassNames.root),
        months: cn(
          'relative flex flex-col gap-4 md:flex-row',
          defaultClassNames.months
        ),
        month: cn('flex w-full flex-col gap-3', defaultClassNames.month),
        nav: cn(
          'pointer-events-none absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1 z-10',
          defaultClassNames.nav
        ),
        button_previous: cn(
          'pointer-events-auto h-8 w-8 inline-flex items-center justify-center rounded-lg border border-border bg-card p-0 text-foreground hover:bg-accent hover:text-accent-foreground select-none disabled:opacity-50 touch-manipulation transition-colors',
          defaultClassNames.button_previous
        ),
        button_next: cn(
          'pointer-events-auto h-8 w-8 inline-flex items-center justify-center rounded-lg border border-border bg-card p-0 text-foreground hover:bg-accent hover:text-accent-foreground select-none disabled:opacity-50 touch-manipulation transition-colors',
          defaultClassNames.button_next
        ),
        month_caption: cn(
          'flex h-8 w-full items-center justify-center px-8',
          defaultClassNames.month_caption
        ),
        dropdowns: cn(
          'flex h-8 w-full items-center justify-center gap-1.5 text-sm font-medium',
          defaultClassNames.dropdowns
        ),
        dropdown_root: cn(
          'relative rounded-md border border-input bg-card shadow-xs has-focus:border-primary has-focus:ring-2 has-focus:ring-ring',
          defaultClassNames.dropdown_root
        ),
        dropdown: cn(
          'absolute inset-0 cursor-pointer bg-popover opacity-0',
          defaultClassNames.dropdown
        ),
        caption_label: cn(
          'select-none font-semibold text-sm text-foreground capitalize',
          captionLayout !== 'label' &&
            'flex h-8 items-center gap-1 rounded-md pl-2 pr-1 font-medium [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:text-muted-foreground',
          defaultClassNames.caption_label
        ),
        month_grid: cn('w-full border-collapse space-y-1', defaultClassNames.month_grid),
        weekdays: cn('flex', defaultClassNames.weekdays),
        weekday: cn(
          'text-muted-foreground flex-1 select-none text-[0.8rem] font-medium text-center py-1',
          defaultClassNames.weekday
        ),
        week: cn('mt-1 flex w-full', defaultClassNames.week),
        day: cn(
          'group/day relative aspect-square h-full w-full select-none p-0 text-center',
          defaultClassNames.day
        ),
        today: cn(
          'font-semibold text-primary',
          defaultClassNames.today
        ),
        outside: cn(
          'text-muted-foreground/40 aria-selected:text-muted-foreground/40',
          defaultClassNames.outside
        ),
        disabled: cn(
          'text-muted-foreground/30 opacity-40 cursor-not-allowed',
          defaultClassNames.disabled
        ),
        hidden: cn('invisible', defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...rootProps }) => (
          <div
            data-slot="calendar"
            ref={rootRef}
            className={cn(className)}
            {...rootProps}
          />
        ),
        Chevron: ({ className, orientation, ...chevronProps }) => {
          if (orientation === 'left') {
            return (
              <ChevronLeftIcon className={cn('h-4 w-4', className)} {...chevronProps} />
            );
          }
          if (orientation === 'right') {
            return (
              <ChevronRightIcon className={cn('h-4 w-4', className)} {...chevronProps} />
            );
          }
          return (
            <ChevronDownIcon className={cn('h-4 w-4', className)} {...chevronProps} />
          );
        },
        DayButton: CalendarDayButton,
        ...components,
      }}
      {...props}
    />
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames();

  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <Button
      ref={ref}
      type="button"
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected={modifiers.selected}
      className={cn(
        'h-9 w-9 p-0 font-normal rounded-lg text-sm transition-colors text-foreground hover:bg-accent hover:text-accent-foreground touch-manipulation',
        modifiers.selected &&
          'bg-primary text-primary-foreground hover:bg-primary-hover hover:text-primary-foreground font-semibold shadow-xs',
        modifiers.today &&
          !modifiers.selected &&
          'border border-primary/40 text-primary font-semibold',
        defaultClassNames.day,
        className
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
