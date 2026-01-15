import { z } from 'zod';
import { PaginationQuerySchema } from './common.js';

export const ResourcesListSchema = z.preprocess(
  val => val ?? {},
  z.object({
    ...PaginationQuerySchema,
    keyword: z.string().optional()
  })
);

export const ResourcesListSchemaResponse = z.object({
  items: z.array(
    z.object({
      title: z.string(),
      magnet: z.string(),
      size: z.number(),
      fansub: z.string().nullish(),
      createdAt: z.string()
    })
  ),
  hasMore: z.boolean()
});

export type ResourcesListQuery = z.infer<typeof ResourcesListSchema>;
