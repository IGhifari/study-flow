'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { ChevronDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

/**
 * Parses a date string or Date object into a local Date instance without UTC drift.
 * Specifically converts "YYYY-MM-DD" to local midnight (year, month - 1, day).
 */
export function parseLocalDate(value: Date | string | null | undefined): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? undefined : value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const y = parseInt(match[1]!, 10);
      const m = parseInt(match[2]!, 10) - 1;
      const d = parseInt(match[3]!, 10);
      return new Date(y, m, d);
    }
    const parsed = new Date(trimmed);
    return isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return undefined;
}

/**
 * Formats a local Date to "YYYY-MM-DD" string without UTC conversion shift.
 */
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Formats a local Date for Indonesian UI display (e.g. "12 Oktober 2026").
 */
export function formatDisplayDate(date: Date | string | null | undefined): string {
  const d = parseLocalDate(date);
  if (!d) return '';
  try {
    return format(d, 'd MMMM yyyy', { locale: id });
  } catch {
    return '';
  }
}

export interface DatePickerProps {
  value?: Date | string | null;
  onChange?: (date: Date | undefined, dateString: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  allowClear?: boolean;
  minDate?: Date | string;
  maxDate?: Date | string;
  id?: string;
  name?: string;
  className?: string;
  triggerClassName?: string;
  hasError?: boolean;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

/**
 * Reusable Basic Date Picker matching shadcn/ui Radix Popover + Calendar composition.
 * - Single date selection with month navigation
 * - Indonesian locale (e.g. "12 Oktober 2026")
 * - Closes popover upon selection
 * - Retains month of stored date upon opening
 * - Optional clear button
 * - Form control sizing (h-11) and semantic design tokens
 * - Dialog and keyboard accessible
 */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Pilih tanggal',
  disabled = false,
  required = false,
  allowClear = true,
  minDate,
  maxDate,
  id: elementId,
  name,
  className,
  triggerClassName,
  hasError = false,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
}: DatePickerProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const dateValue = React.useMemo(() => parseLocalDate(value), [value]);

  const min = React.useMemo(() => parseLocalDate(minDate), [minDate]);
  const max = React.useMemo(() => parseLocalDate(maxDate), [maxDate]);

  // Saat dibuka untuk edit, tampilkan bulan dari tanggal tersimpan
  const [currentMonth, setCurrentMonth] = React.useState<Date | undefined>(
    dateValue || new Date()
  );

  React.useEffect(() => {
    if (open) {
      setCurrentMonth(dateValue || new Date());
    }
  }, [open, dateValue]);

  const handleSelect = (selected: Date | undefined) => {
    if (onChange) {
      const dateString = selected ? formatLocalDate(selected) : undefined;
      onChange(selected, dateString);
    }
    // Tutup popover setelah memilih tanggal
    setOpen(false);
  };

  const isDateDisabled = React.useCallback(
    (day: Date) => {
      if (min && day < min) return true;
      if (max && day > max) return true;
      return false;
    },
    [min, max]
  );

  // Rentang dropdown bulan/tahun: eksplisit agar tenggat beberapa tahun ke depan tetap dapat dipilih.
  const { startMonth, endMonth } = React.useMemo(() => {
    const now = new Date();
    const base = dateValue ?? now;
    const start = min ?? new Date(Math.min(base.getFullYear(), now.getFullYear()) - 5, 0);
    const end = max ?? new Date(Math.max(base.getFullYear(), now.getFullYear()) + 10, 11);
    return { startMonth: start, endMonth: end };
  }, [dateValue, min, max]);

  const displayString = dateValue ? formatDisplayDate(dateValue) : '';

  const popoverContentId = React.useId();

  return (
    <div className={cn('relative inline-flex w-full', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            id={elementId}
            name={name}
            disabled={disabled}
            aria-label={ariaLabel ? `${ariaLabel}${displayString ? `: ${displayString}` : ''}` : undefined}
            aria-labelledby={ariaLabelledBy}
            aria-describedby={ariaDescribedBy}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={open ? popoverContentId : undefined}
            aria-required={required}
            aria-invalid={hasError}
            className={cn(
              'w-full justify-between border-input px-3.5 text-left text-base font-normal shadow-xs sm:text-sm focus-visible:border-primary',
              !dateValue && 'text-muted-foreground',
              hasError && 'border-destructive focus-visible:ring-destructive/30',
              triggerClassName
            )}
          >
            <span className="truncate">{displayString || placeholder}</span>
            <ChevronDownIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          id={popoverContentId}
          className="z-[60] w-auto overflow-hidden p-0"
          align="start"
          sideOffset={4}
        >
          <Calendar
            mode="single"
            selected={dateValue}
            onSelect={handleSelect}
            captionLayout="dropdown"
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            startMonth={startMonth}
            endMonth={endMonth}
            locale={id}
            disabled={isDateDisabled}
            autoFocus
          />
          {dateValue && allowClear && (
            <div className="border-t border-border p-2 flex justify-end bg-card/50">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleSelect(undefined)}
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                Kosongkan tanggal
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export interface DateTimePickerProps {
  value?: string; // "YYYY-MM-DDTHH:mm" or "YYYY-MM-DD"
  onChange?: (value: string) => void;
  id?: string;
  dateId?: string;
  timeId?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  allowClear?: boolean;
  hasError?: boolean;
  placeholder?: string;
  defaultTime?: string; // default "23:59"
  timezone?: string;
  className?: string;
  'aria-describedby'?: string;
}

/**
 * DateTimePicker component combining DatePicker Basic with a dedicated time input.
 * - Used to replace datetime-local inputs
 * - Preserves existing time values
 * - Seamlessly outputs "YYYY-MM-DDTHH:mm"
 * - Maintains timezone integrity
 */
export function DateTimePicker({
  value = '',
  onChange,
  id,
  dateId,
  timeId,
  name,
  disabled = false,
  required = false,
  allowClear = true,
  hasError = false,
  placeholder = 'Pilih tanggal',
  defaultTime = '23:59',
  timezone,
  className,
  'aria-describedby': ariaDescribedBy,
}: DateTimePickerProps): React.JSX.Element {
  const { datePart, timePart } = React.useMemo(() => {
    if (!value || typeof value !== 'string') {
      return { datePart: '', timePart: '' };
    }
    const trimmed = value.trim();
    if (trimmed.includes('T')) {
      const [d, t] = trimmed.split('T');
      return { datePart: d || '', timePart: (t || '').slice(0, 5) };
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return { datePart: trimmed, timePart: '' };
    }
    return { datePart: '', timePart: '' };
  }, [value]);

  const [localTime, setLocalTime] = React.useState(timePart || defaultTime);

  React.useEffect(() => {
    if (timePart) {
      setLocalTime(timePart);
    }
  }, [timePart]);

  const handleDateChange = (_date: Date | undefined, dateStr: string | undefined) => {
    if (!dateStr) {
      onChange?.('');
      return;
    }
    const timeToApply = timePart || localTime || defaultTime;
    onChange?.(`${dateStr}T${timeToApply}`);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    setLocalTime(newTime);
    if (!datePart) return;
    onChange?.(newTime ? `${datePart}T${newTime}` : `${datePart}T${defaultTime}`);
  };

  const primaryDateId = dateId || id;
  const primaryTimeId = timeId || (id ? `${id}-time` : undefined);

  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-end', className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Label htmlFor={primaryDateId} className="text-xs font-medium text-muted-foreground">
          Tanggal
        </Label>
        <DatePicker
          id={primaryDateId}
          name={name ? `${name}_date` : undefined}
          value={datePart}
          onChange={handleDateChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          allowClear={allowClear && !required}
          hasError={hasError}
          aria-describedby={ariaDescribedBy}
        />
      </div>
      <div className="flex flex-col gap-1.5 sm:w-32">
        <Label htmlFor={primaryTimeId} className="text-xs font-medium text-muted-foreground">
          Jam
        </Label>
        <Input
          id={primaryTimeId}
          name={name ? `${name}_time` : undefined}
          type="time"
          value={timePart || localTime}
          onChange={handleTimeChange}
          disabled={disabled || !datePart}
          aria-describedby={ariaDescribedBy}
          className={cn(
            'h-11 appearance-none bg-card [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none',
            hasError && 'border-destructive focus-visible:ring-destructive/30'
          )}
        />
      </div>
    </div>
  );
}
