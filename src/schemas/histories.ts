import { z } from 'zod';
import { IdSchema, PaginationQuerySchema } from './common.js';

export const HistoryListSchema = z.preprocess(
  val => val ?? {},
  z.object({
    ...PaginationQuerySchema,
    keyword: z.string().optional(),
    sort: z.enum(['createdAt', 'time']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc')
  })
);

export type HistoryListQuery = z.infer<typeof HistoryListSchema>;

export const DeleteHistoryParamsSchema = z.object({
  id: IdSchema
});

export type DeleteHistoryParams = z.infer<typeof DeleteHistoryParamsSchema>;

export const HistoryListSchemaResponse = z.object({
  items: z.array(
    z.object({
      id: IdSchema,
      user: z.object({
        name: z.string()
      }),
      anime: z.object({
        name: z.string(),
        cover: z.string()
      }),
      time: z.number(),
      createdAt: z.date()
    })
  ),
  total: z.number()
});
