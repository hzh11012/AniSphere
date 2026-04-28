import { z } from 'zod';
import { IdSchema, PaginationQuerySchema } from './common.js';

export const DanmakuListSchema = z.preprocess(
  val => val ?? {},
  z.object({
    ...PaginationQuerySchema,
    keyword: z.string().optional(),
    mode: z.enum(['scroll', 'top', 'bottom']).optional(),
    sort: z.enum(['createdAt', 'time']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc')
  })
);

export type DanmakuListQuery = z.infer<typeof DanmakuListSchema>;

export const DanmakuListSchemaResponse = z.object({
  items: z.array(
    z.object({
      id: IdSchema,
      user: z.object({ name: z.string() }),
      anime: z.object({ name: z.string() }),
      text: z.string(),
      mode: z.enum(['scroll', 'top', 'bottom']),
      color: z.string(),
      time: z.number(),
      createdAt: z.date()
    })
  ),
  total: z.number()
});

export const DeleteDanmakuParamsSchema = z.object({
  id: IdSchema
});

export type DeleteDanmakuParams = z.infer<typeof DeleteDanmakuParamsSchema>;
