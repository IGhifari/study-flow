import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

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
