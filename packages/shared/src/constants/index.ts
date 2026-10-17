export const APP_NAME = 'StudyFlow';

export const DEFAULT_TIMEZONE = 'Asia/Jakarta';

export const COOKIE_NAMES = {
  accessToken: 'studyflow_access_token',
  refreshToken: 'studyflow_refresh_token',
  oauthTx: 'studyflow_oauth_tx',
} as const;

export const ADMIN_COOKIE_NAMES = {
  accessToken: 'studyflow_admin_access_token',
  refreshToken: 'studyflow_admin_refresh_token',
} as const;

export const AUTH_LIMITS = {
  accessTokenExpirySeconds: 15 * 60, // 15 minutes
  refreshTokenExpiryDays: 7, // 7 days
  passwordMinLength: 12,
  passwordMaxLength: 128,
} as const;

export const FILE_UPLOAD_LIMITS = {
  maxSizeBytes: 20 * 1024 * 1024, // 20 MB
  maxPages: 100,
  allowedMimeTypes: ['application/pdf'],
} as const;

export const AI_QUOTA_LIMITS = {
  dailyGenerations: 20,
  maxConcurrentGenerations: 2,
  dailyUploads: 10,
  storageLimitBytes: 200 * 1024 * 1024, // 200 MB
} as const;

export const QUEUE_NAMES = {
  smoke: 'studyflow-smoke-queue',
  documentProcessing: 'studyflow-document-processing',
  aiGeneration: 'studyflow-ai-generation',
  assignmentReminder: 'studyflow-assignment-reminder',
} as const;

export const AI_SUMMARY_LIMITS = {
  maxPages: 100,
  maxTotalCharacters: 120_000, // Maximum total processable characters across max 3 chunks of 40,000 characters
  maxChunkCharacters: 40_000,  // Maximum characters per chunk / single page
  maxChunks: 3,                // Maximum chunk iterations per document
  minCharacters: 50,           // Minimum extracted text characters to generate summary
} as const;

export const AI_FLASHCARD_LIMITS = {
  allowedCounts: [5, 10, 20] as const,
  defaultCount: 10,
  minCharacters: 50,
} as const;

export const AI_QUIZ_LIMITS = {
  allowedCounts: [5, 10] as const,
  defaultCount: 5,
  minCharacters: 50,
} as const;

export interface TimezoneOption {
  value: string;
  label: string;
}

export const TIMEZONE_OPTIONS: readonly TimezoneOption[] = [
  { value: 'Asia/Jakarta', label: 'WIB — Asia/Jakarta (UTC+7, Indonesia Barat)' },
  { value: 'Asia/Makassar', label: 'WITA — Asia/Makassar (UTC+8, Indonesia Tengah)' },
  { value: 'Asia/Jayapura', label: 'WIT — Asia/Jayapura (UTC+9, Indonesia Timur)' },
  { value: 'Asia/Pontianak', label: 'WIB — Asia/Pontianak (UTC+7, Kalimantan Barat)' },
  { value: 'Asia/Singapore', label: 'SGT — Asia/Singapore (UTC+8)' },
  { value: 'Asia/Tokyo', label: 'JST — Asia/Tokyo (UTC+9)' },
  { value: 'UTC', label: 'UTC — Universal Time Coordinated' },
] as const;

export const PRIORITY_LABELS: Record<'HIGH' | 'MEDIUM' | 'LOW', string> = {
  HIGH: 'Tinggi',
  MEDIUM: 'Sedang',
  LOW: 'Rendah',
} as const;
