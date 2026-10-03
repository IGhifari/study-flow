import { z } from 'zod';

export const SmokeJobDataSchema = z.object({
  jobId: z.string(),
  message: z.string(),
  enqueuedAt: z.string().datetime(),
});
export type SmokeJobData = z.infer<typeof SmokeJobDataSchema>;

export const SmokeJobResultSchema = z.object({
  jobId: z.string(),
  processedAt: z.string().datetime(),
  status: z.literal('completed'),
  durationMs: z.number().nonnegative(),
});
export type SmokeJobResult = z.infer<typeof SmokeJobResultSchema>;
