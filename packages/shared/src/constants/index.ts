export const APP_NAME = 'StudyFlow';

export const DEFAULT_TIMEZONE = 'Asia/Jakarta';

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
} as const;
