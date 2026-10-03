import { z } from 'zod';

export const HealthStatusSchema = z.enum(['ok', 'degraded', 'down']);
export type HealthStatus = z.infer<typeof HealthStatusSchema>;

export const HealthResponseSchema = z.object({
  status: HealthStatusSchema,
  timestamp: z.string().datetime(),
  uptime: z.number().nonnegative(),
  service: z.string(),
  version: z.string(),
  environment: z.string(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const DependencyStatusSchema = z.object({
  status: z.enum(['up', 'down']),
  latencyMs: z.number().nullable(),
  message: z.string().optional(),
});
export type DependencyStatus = z.infer<typeof DependencyStatusSchema>;

export const ReadinessResponseSchema = z.object({
  status: HealthStatusSchema,
  timestamp: z.string().datetime(),
  service: z.string(),
  dependencies: z.object({
    database: DependencyStatusSchema,
    redis: DependencyStatusSchema,
  }),
});
export type ReadinessResponse = z.infer<typeof ReadinessResponseSchema>;
