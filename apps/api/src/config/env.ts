import { z } from 'zod';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { assertTestDatabaseUrl } from './testDbGuard.js';

// Resolve directory paths relative to this module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, '../..'); // apps/api
const rootDir = path.resolve(appDir, '../..'); // repository root

// Preserve runtime environment variables set by test runners (e.g. vitest env config)
const isTestMode = process.env.NODE_ENV === 'test';

const testDatabaseUrl = isTestMode ? process.env.DATABASE_URL : undefined;
const originalNodeEnv = process.env.NODE_ENV;

// 1. Load root .env first (base settings across workspaces)
const rootEnvPath = path.join(rootDir, '.env');
if (fs.existsSync(rootEnvPath)) {
  // Never override externally set env vars (like Playwright/Vitest provided ones)
  dotenv.config({ path: rootEnvPath });
}

// 2. Load apps/api/.env second with override: true (workspace-specific secrets and overrides)
const appEnvPath = path.join(appDir, '.env');
if (fs.existsSync(appEnvPath)) {
  if (isTestMode) {
    // In test mode, we only load the file to fill missing values, never to override existing test config
    dotenv.config({ path: appEnvPath });
  } else {
    dotenv.config({ path: appEnvPath, override: true });
  }
}

// Fallback: also load default process.cwd() .env if different (non-overriding)
dotenv.config();

// Re-enforce externally set variables that might have been overwritten if we used override: true
// (Though we guarded it above, this is defense-in-depth)
if (isTestMode) {
  if (originalNodeEnv) process.env.NODE_ENV = originalNodeEnv;
  if (testDatabaseUrl) process.env.DATABASE_URL = testDatabaseUrl;
}

const EnvSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required').default('redis://localhost:6379'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  JWT_ACCESS_SECRET: z.string().min(16).default('studyflow_dev_jwt_access_secret_key_123456'),
  JWT_REFRESH_SECRET: z.string().min(16).default('studyflow_dev_jwt_refresh_secret_key_123456'),
  COOKIE_SECRET: z.string().min(16).default('studyflow_dev_cookie_signing_secret_123456'),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN_DAYS: z.coerce.number().default(7),
  // Proxy configuration: Controls Express 'trust proxy' setting.
  // Defaults to 'loopback' (trusts 127.0.0.1/::1, matching local Next.js BFF proxy).
  // In production with reverse proxies, set to explicit CIDR/IP list (e.g. '10.0.0.0/8, 127.0.0.1').
  // Can be 'false', 'true', 'loopback', or comma-separated IPs/subnets.
  TRUST_PROXY: z.string().default('loopback'),
  // Rate limiting shared store ('redis' | 'memory')
  RATE_LIMIT_STORE: z
    .enum(['redis', 'memory'])
    .default(process.env.NODE_ENV === 'test' ? 'memory' : 'redis'),
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
  STORAGE_SIGNED_URL_EXPIRES_IN: z.coerce.number().default(300), // 5 minutes default
  LOCAL_STORAGE_DIR: z.string().optional(),
  API_BASE_URL: z.string().default('http://localhost:4000'),
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
  // Google OAuth Configuration
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_REDIRECT_URI: z.string().default('http://localhost:3000/api/auth/google/callback'),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const missingKeys = result.error.errors.map((err) => err.path.join('.')).join(', ');
    console.error(`[FATAL] Environment validation failed. Invalid or missing variables: ${missingKeys}`);
    process.exit(1);
  }
  if (result.data.NODE_ENV === 'test') {
    // Throws (never prints credentials) if a test-mode process targets a non-test database
    assertTestDatabaseUrl(result.data.DATABASE_URL, 'DATABASE_URL');
  }
  return result.data;
}

export const env = loadEnv();
