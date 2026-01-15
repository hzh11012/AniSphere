import { z } from 'zod';
import { PaginationQuerySchema, IdSchema } from './common.js';

export const WebhookSchema = z.object({
  hash: z.string().min(1),
  tag: z.string().optional()
});

export type WebhookQuery = z.infer<typeof WebhookSchema>;

const TaskStatus = [
  'pending',
  'transcoding',
  'transcoded',
  'completed',
  'failed'
] as const;

export const TaskListSchema = z.preprocess(
  val => val ?? {},
  z.object({
    ...PaginationQuerySchema,
    keyword: z.string().max(500).optional(),
    status: z.enum(TaskStatus).optional(),
    sort: z.enum(['createdAt', 'fileSize']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc')
  })
);

export type TaskListQuery = z.infer<typeof TaskListSchema>;

export const TaskListSchemaResponse = z.object({
  items: z.array(
    z.object({
      id: IdSchema,
      filename: z.string(),
      fileSize: z.number(),
      needsTranscode: z.boolean(),
      status: z.enum(TaskStatus),
      transcodeProgress: z.number(),
      errorMessage: z.string().nullish(),
      createdAt: z.date()
    })
  ),
  total: z.number()
});
