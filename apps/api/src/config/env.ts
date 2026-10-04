import { z } from 'zod';
import dotenv from 'dotenv';
import { assertTestDatabaseUrl } from './testDbGuard.js';

dotenv.config();

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
