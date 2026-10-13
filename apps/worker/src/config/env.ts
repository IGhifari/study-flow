import { z } from 'zod';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

// Resolve directory paths relative to this module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workerDir = path.resolve(__dirname, '../..'); // apps/worker
const rootDir = path.resolve(workerDir, '../..'); // repository root

// Preserve runtime environment variables set by test runners (e.g. vitest env config)
const isTestMode = process.env.NODE_ENV === 'test';
const testDatabaseUrl = isTestMode ? process.env.DATABASE_URL : undefined;
const originalNodeEnv = process.env.NODE_ENV;

// 1. Load root .env first (base settings across workspaces)
const rootEnvPath = path.join(rootDir, '.env');
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}

// 2. Load apps/worker/.env second with override: true (workspace-specific secrets and overrides)
const workerEnvPath = path.join(workerDir, '.env');
if (fs.existsSync(workerEnvPath)) {
  if (isTestMode) {
    // In test mode, we only load the file to fill missing values, never to override existing test config
    dotenv.config({ path: workerEnvPath });
  } else {
    dotenv.config({ path: workerEnvPath, override: true });
  }
}

// Fallback: also load default process.cwd() .env if different
dotenv.config();

// Restore test environment variables if running in test mode
if (isTestMode) {
  if (originalNodeEnv) process.env.NODE_ENV = originalNodeEnv;
  if (testDatabaseUrl) process.env.DATABASE_URL = testDatabaseUrl;
}

const WorkerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required').default('redis://localhost:6379'),
  // Storage configuration (M5)
  STORAGE_DRIVER: z
    .enum(['supabase', 'local', 'memory', 'none'])
    .default(
      process.env.NODE_ENV === 'test'
        ? 'memory'
        : process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
        ? 'supabase'
        : 'local'
    ),
  SUPABASE_URL: z.string().optional().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(''),
  SUPABASE_STORAGE_BUCKET: z.string().default('studyflow-materials'),
  LOCAL_STORAGE_DIR: z.string().optional(),
  // AI Configuration (M6)
  AI_PROVIDER: z
    .enum(['gemini', 'mock', 'none'])
    .default(
      process.env.NODE_ENV === 'test'
        ? 'mock'
        : process.env.AI_PROVIDER === 'gemini'
        ? 'gemini'
        : process.env.AI_PROVIDER === 'mock'
        ? 'mock'
        : process.env.GEMINI_API_KEY
        ? 'gemini'
        : 'none'
    ),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  // Provider call rate limiting (M6)
  AI_CALLS_PER_MINUTE: z.coerce.number().int().positive().default(15),
  AI_MAX_CALLS_PER_JOB: z.coerce.number().int().positive().default(8),
  // Public Web App URL for links
  APP_PUBLIC_URL: z.string().default('http://localhost:3000'),
  // SMTP & Email Configuration for Deadline Reminders
  EMAIL_DRIVER: z
    .enum(['smtp', 'mock'])
    .default(process.env.NODE_ENV === 'test' ? 'mock' : 'smtp'),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_FROM: z.string().default('StudyFlow <no-reply@studyflow.local>'),
});

export type WorkerEnv = z.infer<typeof WorkerEnvSchema>;

function loadWorkerEnv(): WorkerEnv {
  const result = WorkerEnvSchema.safeParse(process.env);
  if (!result.success) {
    const missingKeys = result.error.errors.map((err) => err.path.join('.')).join(', ');
    console.error(`[FATAL] Worker environment validation failed. Invalid or missing variables: ${missingKeys}`);
    process.exit(1);
  }
  return result.data;
}

export const env = loadWorkerEnv();
