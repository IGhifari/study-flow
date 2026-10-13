import {
  CalendarEvent,
  getLocalComponents,
  isValidTimezone,
} from '@studyflow/shared';

export const INDONESIAN_MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export const INDONESIAN_DAY_NAMES = [
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
  'Minggu',
];

export const SHORT_DAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

export function padZero(num: number): string {
  return String(num).padStart(2, '0');
}

export function formatUtcToDateString(date: Date): string {
  return `${date.getUTCFullYear()}-${padZero(date.getUTCMonth() + 1)}-${padZero(date.getUTCDate())}`;
}

export function parseDateString(dateStr: string): { year: number; month: number; day: number } {
  const parts = dateStr.split('-').map(Number);
  return { year: parts[0]!, month: parts[1]!, day: parts[2]! };
}

/**
 * Mendapatkan tanggal hari ini (YYYY-MM-DD) berdasarkan timezone pengguna.
 */
export function getTodayDateString(timezone = 'Asia/Jakarta'): string {
  const safeTz = isValidTimezone(timezone) ? timezone : 'Asia/Jakarta';
  const comp = getLocalComponents(new Date(), safeTz);
  return `${comp.year}-${padZero(comp.month)}-${padZero(comp.day)}`;
}

/**
 * Menghasilkan rentang tanggal untuk grid kalender bulanan (mulai hari Senin).
 * Mengembalikan startDate (inklusif) dan endDate (eksklusif untuk query [start, end)),
 * beserta daftar semua tanggal YYYY-MM-DD dalam grid.
 */
export function getMonthGridRange(
  year: number,
  month: number // 1 - 12
): { startDate: string; endDate: string; days: string[] } {
  // 1. Hari pertama bulan
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const jsDayFirst = firstOfMonth.getUTCDay();
  const isoDayFirst = jsDayFirst === 0 ? 7 : jsDayFirst;
  const daysBack = isoDayFirst - 1; // Mundur ke Senin terdekat

  const gridStart = new Date(Date.UTC(year, month - 1, 1 - daysBack));

  // 2. Hari terakhir bulan
  const lastOfMonth = new Date(Date.UTC(year, month, 0));
  const jsDayLast = lastOfMonth.getUTCDay();
  const isoDayLast = jsDayLast === 0 ? 7 : jsDayLast;
  const daysForward = 7 - isoDayLast; // Maju ke Minggu terdekat

  const gridEndInclusive = new Date(Date.UTC(year, month, 0 + daysForward));
  const gridEndExclusive = new Date(Date.UTC(year, month, 0 + daysForward + 1));

  const days: string[] = [];
  const cursor = new Date(gridStart.getTime());
  while (cursor.getTime() <= gridEndInclusive.getTime()) {
    days.push(formatUtcToDateString(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return {
    startDate: formatUtcToDateString(gridStart),
    endDate: formatUtcToDateString(gridEndExclusive),
    days,
  };
}

/**
 * Menghasilkan rentang tanggal 7 hari (Senin s/d Minggu) berdasarkan referensi tanggal.
 */
export function getWeekRange(
  referenceDateStr: string
): { startDate: string; endDate: string; days: string[] } {
  const { year, month, day } = parseDateString(referenceDateStr);
  const refDate = new Date(Date.UTC(year, month - 1, day));
  const jsDay = refDate.getUTCDay();
  const isoDay = jsDay === 0 ? 7 : jsDay;
  const daysBack = isoDay - 1;

  const monday = new Date(Date.UTC(year, month - 1, day - daysBack));
  const nextMonday = new Date(Date.UTC(year, month - 1, day - daysBack + 7));

  const days: string[] = [];
  const cursor = new Date(monday.getTime());
  for (let i = 0; i < 7; i++) {
    days.push(formatUtcToDateString(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return {
    startDate: formatUtcToDateString(monday),
    endDate: formatUtcToDateString(nextMonday),
    days,
  };
}

/**
 * Format label bulan dan tahun, misal "Oktober 2026"
 */
export function formatMonthHeader(year: number, month: number): string {
  const monthName = INDONESIAN_MONTH_NAMES[month - 1] || '';
  return `${monthName} ${year}`;
}

/**
 * Format label rentang minggu, misal "12 – 18 Okt 2026"
 */
export function formatWeekHeader(startStr: string, endInclusiveStr: string): string {
  const start = parseDateString(startStr);
  const end = parseDateString(endInclusiveStr);

  const startMonthName = INDONESIAN_MONTH_NAMES[start.month - 1]?.slice(0, 3);
  const endMonthName = INDONESIAN_MONTH_NAMES[end.month - 1]?.slice(0, 3);

  if (start.year === end.year) {
    if (start.month === end.month) {
      return `${start.day} – ${end.day} ${startMonthName} ${start.year}`;
    }
    return `${start.day} ${startMonthName} – ${end.day} ${endMonthName} ${start.year}`;
  }
  return `${start.day} ${startMonthName} ${start.year} – ${end.day} ${endMonthName} ${end.year}`;
}

/**
 * Format tanggal lengkap untuk header agenda, misal "Rabu, 14 Oktober 2026"
 */
export function formatAgendaDateHeader(dateStr: string): string {
  const { year, month, day } = parseDateString(dateStr);
  const date = new Date(Date.UTC(year, month - 1, day));
  const jsDay = date.getUTCDay();
  const isoDay = jsDay === 0 ? 7 : jsDay;
  const dayName = INDONESIAN_DAY_NAMES[isoDay - 1] || '';
  const monthName = INDONESIAN_MONTH_NAMES[month - 1] || '';

  return `${dayName}, ${day} ${monthName} ${year}`;
}

/**
 * Kelompokkan events berdasarkan tanggal (YYYY-MM-DD)
 */
export function groupEventsByDate(events: CalendarEvent[]): Record<string, CalendarEvent[]> {
  const grouped: Record<string, CalendarEvent[]> = {};
  for (const event of events) {
    if (!grouped[event.date]) {
      grouped[event.date] = [];
    }
    grouped[event.date]!.push(event);
  }
  return grouped;
}

/**
 * Format timezone ringkas untuk header atau badge, misal "WIB (Asia/Jakarta)"
 */
export function formatTimezoneBadge(timezone: string): string {
  const safeTz = isValidTimezone(timezone) ? timezone : 'Asia/Jakarta';
  try {
    const formatter = new Intl.DateTimeFormat('id-ID', {
      timeZone: safeTz,
      timeZoneName: 'short',
    });
    const parts = formatter.formatToParts(new Date());
    const tzPart = parts.find((p) => p.type === 'timeZoneName')?.value;
    if (tzPart) {
      return `${tzPart} (${safeTz})`;
    }
  } catch {
    // fallback
  }
  return safeTz;
}
