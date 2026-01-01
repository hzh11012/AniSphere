import { z } from 'zod';

export const HealthResponseSchema = z.object({
  status: z.string(),
  timestamp: z.number(),
  uptime: z.number(),
  environment: z.string(),
  database: z.object({
    status: z.string(),
    latency: z.optional(z.number())
  }),
  redis: z.object({
    status: z.string(),
    latency: z.optional(z.number())
  })
});
