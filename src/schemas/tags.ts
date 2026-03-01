import { z } from 'zod';
import { IdSchema, PaginationQuerySchema } from './common.js';

export const TagsListSchema = z.preprocess(
  val => val ?? {},
  z.object({
    ...PaginationQuerySchema,
    keyword: z.string().optional(),
    sort: z.enum(['createdAt']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc')
  })
);

export const TagsListSchemaResponse = z.object({
  items: z.array(
    z.object({
      id: IdSchema,
      name: z.string(),
      createdAt: z.date()
    })
  ),
  total: z.number()
});

export type TagsListQuery = z.infer<typeof TagsListSchema>;
