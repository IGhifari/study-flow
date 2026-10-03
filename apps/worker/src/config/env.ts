import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const WorkerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required').default('redis://localhost:6379'),
  DATABASE_URL: z.string().optional(),
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
