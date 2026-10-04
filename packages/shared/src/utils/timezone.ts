/**
 * Timezone utilities using standard ECMAScript Intl API
 * Guarantees support for all IANA timezones (Asia/Jakarta, America/New_York, etc.)
 * Handles DST, day boundaries, and strict validation without arbitrary hardcoded offsets.
 */

export function isValidTimezone(tz: string): boolean {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export interface ParseDateInputOptions {
  /**
   * The IANA timezone of the user (e.g. 'Asia/Jakarta', 'America/New_York').
   * Defaults to 'Asia/Jakarta' if not provided or invalid.
   */
  timezone?: string;
  /**
   * If true, date-only inputs (YYYY-MM-DD) default to 23:59:00 instead of 00:00:00.
   * StudyFlow PRD rule: Date-only inputs mean 23:59 in the user's profile timezone.
   */
  defaultToEndOfDay?: boolean;
}

/**
 * Get the UTC offset in minutes for a specific instant in a given timezone.
 */
function getTimezoneOffsetMinutes(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  let year = 0, month = 0, day = 0, hour = 0, minute = 0, second = 0;

  for (const part of parts) {
    if (part.type === 'year') year = parseInt(part.value, 10);
    else if (part.type === 'month') month = parseInt(part.value, 10);
    else if (part.type === 'day') day = parseInt(part.value, 10);
    else if (part.type === 'hour') {
      const h = parseInt(part.value, 10);
      hour = h === 24 ? 0 : h;
    }
    else if (part.type === 'minute') minute = parseInt(part.value, 10);
    else if (part.type === 'second') second = parseInt(part.value, 10);
  }

  const asLocalInUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return (asLocalInUtc - date.getTime()) / (60 * 1000);
}

export function getLocalComponents(date: Date, timezone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const safeTz = isValidTimezone(timezone) ? timezone : 'Asia/Jakarta';
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  let year = 0, month = 0, day = 0, hour = 0, minute = 0, second = 0;

  for (const part of parts) {
    if (part.type === 'year') year = parseInt(part.value, 10);
    else if (part.type === 'month') month = parseInt(part.value, 10);
    else if (part.type === 'day') day = parseInt(part.value, 10);
    else if (part.type === 'hour') {
      const h = parseInt(part.value, 10);
      hour = h === 24 ? 0 : h;
    }
    else if (part.type === 'minute') minute = parseInt(part.value, 10);
    else if (part.type === 'second') second = parseInt(part.value, 10);
  }

  return { year, month, day, hour, minute, second };
}

/**
 * Converts local date components in a given timezone to an exact UTC Date instance.
 * Strict: rejects non-existent (spring-forward gap) and ambiguous (fall-back overlap)
 * local times without silent normalization.
 */
export function localComponentsToUtc(
  year: number,
  month: number, // 1-12
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  timezone = 'Asia/Jakarta'
): Date {
  const safeTz = isValidTimezone(timezone) ? timezone : 'Asia/Jakarta';

  // 1. Initial guess: treat local components as UTC
  let utcTimestamp = Date.UTC(year, month - 1, day, hour, minute, second);

  // 2. Determine offset at that initial guess
  let offsetMinutes = getTimezoneOffsetMinutes(new Date(utcTimestamp), safeTz);

  // 3. Shift by offset
  utcTimestamp -= offsetMinutes * 60 * 1000;

  // 4. Refine offset in case of DST transitions near the boundary
  const refinedOffset = getTimezoneOffsetMinutes(new Date(utcTimestamp), safeTz);
  if (refinedOffset !== offsetMinutes) {
    utcTimestamp = Date.UTC(year, month - 1, day, hour, minute, second) - refinedOffset * 60 * 1000;
  }

  const resultDate = new Date(utcTimestamp);

  // 5. Verification: round-trip check to catch non-existent or ambiguous local times
  const roundTrip = getLocalComponents(resultDate, safeTz);
  if (
    roundTrip.year !== year ||
    roundTrip.month !== month ||
    roundTrip.day !== day ||
    roundTrip.hour !== hour ||
    roundTrip.minute !== minute
  ) {
    throw new Error(
      `Waktu lokal ${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} tidak ada pada zona waktu ${safeTz} karena peralihan waktu (DST).`
    );
  }

  // Check for ambiguous time (fall-back overlap where two UTC instants give same local time)
  // Check ±1 hour to see if another UTC time produces the exact same local components
  const earlierUtc = new Date(utcTimestamp - 3600 * 1000);
  const earlierLocal = getLocalComponents(earlierUtc, safeTz);
  const laterUtc = new Date(utcTimestamp + 3600 * 1000);
  const laterLocal = getLocalComponents(laterUtc, safeTz);

  if (
    (earlierLocal.year === year && earlierLocal.month === month && earlierLocal.day === day && earlierLocal.hour === hour && earlierLocal.minute === minute) ||
    (laterLocal.year === year && laterLocal.month === month && laterLocal.day === day && laterLocal.hour === hour && laterLocal.minute === minute)
  ) {
    throw new Error(
      `Waktu lokal ${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ambigu (terjadi dua kali) pada zona waktu ${safeTz} karena peralihan waktu (DST). Gunakan format ISO dengan offset spesifik.`
    );
  }

  return resultDate;
}

/**
 * Parses a date string into an exact UTC Date in the context of the user's timezone.
 * Supported formats:
 * - "YYYY-MM-DD" -> defaults to 23:59:00 in the given timezone (PRD requirement)
 * - "YYYY-MM-DDTHH:mm" or "YYYY-MM-DD HH:mm" -> interpreted in the user's timezone
 * - Full ISO-8601 with offset (e.g. "2026-10-15T16:59:00.000Z") -> parsed directly
 */
export function parseUserDateInput(
  input: string | Date,
  options: ParseDateInputOptions = {}
): Date {
  if (input instanceof Date) return input;
  if (!input || typeof input !== 'string') {
    throw new Error('Tanggal input tidak valid');
  }

  const tz = options.timezone && isValidTimezone(options.timezone) ? options.timezone : 'Asia/Jakarta';
  const defaultToEndOfDay = options.defaultToEndOfDay ?? true;
  const trimmed = input.trim();

  // 1. Date only: YYYY-MM-DD
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnlyMatch) {
    const year = parseInt(dateOnlyMatch[1]!, 10);
    const month = parseInt(dateOnlyMatch[2]!, 10);
    const day = parseInt(dateOnlyMatch[3]!, 10);

    const hour = defaultToEndOfDay ? 23 : 0;
    const minute = defaultToEndOfDay ? 59 : 0;
    const second = defaultToEndOfDay ? 0 : 0;

    return localComponentsToUtc(year, month, day, hour, minute, second, tz);
  }

  // 2. Date and Time without explicit offset: YYYY-MM-DDTHH:mm or YYYY-MM-DD HH:mm(:ss)?
  const localDateTimeMatch = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (localDateTimeMatch) {
    const year = parseInt(localDateTimeMatch[1]!, 10);
    const month = parseInt(localDateTimeMatch[2]!, 10);
    const day = parseInt(localDateTimeMatch[3]!, 10);
    const hour = parseInt(localDateTimeMatch[4]!, 10);
    const minute = parseInt(localDateTimeMatch[5]!, 10);
    const second = localDateTimeMatch[6] ? parseInt(localDateTimeMatch[6], 10) : 0;

    return localComponentsToUtc(year, month, day, hour, minute, second, tz);
  }

  // 3. Full ISO string with timezone or offset (Z or +HH:mm / -HH:mm)
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) {
    throw new Error(`Format tanggal tidak valid: "${input}"`);
  }
  return parsed;
}

/**
 * Returns the start of today and end of today in the user's timezone.
 */
export function getUserTodayRange(now: Date = new Date(), timezone = 'Asia/Jakarta'): {
  startOfToday: Date;
  endOfToday: Date;
  startOfNext7Days: Date;
  endOf7Days: Date;
} {
  const safeTz = isValidTimezone(timezone) ? timezone : 'Asia/Jakarta';

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });

  const parts = formatter.formatToParts(now);
  let year = 0, month = 0, day = 0;
  for (const part of parts) {
    if (part.type === 'year') year = parseInt(part.value, 10);
    else if (part.type === 'month') month = parseInt(part.value, 10);
    else if (part.type === 'day') day = parseInt(part.value, 10);
  }

  const startOfToday = localComponentsToUtc(year, month, day, 0, 0, 0, safeTz);
  const endOfToday = localComponentsToUtc(year, month, day, 23, 59, 59, safeTz);

  // 7 days ahead: from startOfToday until start of day 8 (covering 7 calendar days locally)
  const after7DaysLocal = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);
  const afterParts = formatter.formatToParts(after7DaysLocal);
  let y7 = 0, m7 = 0, d7 = 0;
  for (const p of afterParts) {
    if (p.type === 'year') y7 = parseInt(p.value, 10);
    else if (p.type === 'month') m7 = parseInt(p.value, 10);
    else if (p.type === 'day') d7 = parseInt(p.value, 10);
  }

  const endOf7Days = localComponentsToUtc(y7, m7, d7, 23, 59, 59, safeTz);

  return {
    startOfToday,
    endOfToday,
    startOfNext7Days: endOfToday,
    endOf7Days,
  };
}

/**
 * Formats a UTC date for user display in their configured timezone with Indonesian locale.
 * Example: "14 Okt 2026, 23:59 WIB"
 */
export function formatUserDateTime(date: Date | string, timezone = 'Asia/Jakarta'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';

  const safeTz = isValidTimezone(timezone) ? timezone : 'Asia/Jakarta';

  const formatter = new Intl.DateTimeFormat('id-ID', {
    timeZone: safeTz,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  return formatter.format(d);
}

/**
 * Formats a UTC date for an HTML datetime-local input (YYYY-MM-DDTHH:mm) in user's timezone.
 */
export function toUserDateTimeInputValue(date: Date | string, timezone = 'Asia/Jakarta'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const safeTz = isValidTimezone(timezone) ? timezone : 'Asia/Jakarta';

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  let year = '', month = '', day = '', hour = '', minute = '';
  for (const part of parts) {
    if (part.type === 'year') year = part.value;
    else if (part.type === 'month') month = part.value;
    else if (part.type === 'day') day = part.value;
    else if (part.type === 'hour') {
      const h = parseInt(part.value, 10);
      hour = (h === 24 ? 0 : h).toString().padStart(2, '0');
    }
    else if (part.type === 'minute') minute = part.value.padStart(2, '0');
  }

  return `${year}-${month}-${day}T${hour}:${minute}`;
}
