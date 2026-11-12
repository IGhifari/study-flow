import type { AdminJobType } from '@studyflow/shared';

export function formatLocalDateTime(
  isoString: string | null | undefined,
  includeSeconds = false
): string {
  if (!isoString) return '-';
  try {
    const date = new Date(isoString);
    return `${date.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...(includeSeconds ? { second: '2-digit' } : {}),
    })} WIB`;
  } catch {
    return isoString;
  }
}

export function formatSyncTime(date: Date): string {
  return `${date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })} WIB`;
}

export function formatJobDuration(durationMs: number | null | undefined): string {
  if (durationMs === null || durationMs === undefined || durationMs < 0) {
    return '-';
  }
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }
  return `${(durationMs / 1000).toFixed(1)}s`;
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function getJobTypeLabel(type: AdminJobType): string {
  switch (type) {
    case 'DOCUMENT_EXTRACTION':
      return 'Ekstraksi Dokumen';
    case 'DOCUMENT_CLEANUP':
      return 'Pembersihan Dokumen';
    case 'AI_SUMMARY_GENERATION':
      return 'Ringkasan AI';
    case 'AI_FLASHCARD_GENERATION':
      return 'Flashcard AI';
    case 'AI_QUIZ_GENERATION':
      return 'Kuis AI';
    default:
      return type;
  }
}

export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  const escaped = String(value).replace(/"/g, '""');
  return `"${escaped}"`;
}

export function downloadCsvFile(
  filename: string,
  rows: Array<Array<string | number | null | undefined>>
): void {
  const csvContent =
    '\uFEFF' + rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
