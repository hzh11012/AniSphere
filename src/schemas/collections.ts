import { z } from 'zod';
import { IdSchema, PaginationQuerySchema } from './common.js';

export const CollectionListSchema = z.preprocess(
  val => val ?? {},
  z.object({
    ...PaginationQuerySchema,
    keyword: z.string().optional(),
    sort: z.enum(['createdAt']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc')
  })
);

export type CollectionListQuery = z.infer<typeof CollectionListSchema>;

export const DeleteCollectionParamsSchema = z.object({
  id: IdSchema
});

export type DeleteCollectionParams = z.infer<
  typeof DeleteCollectionParamsSchema
>;

export const CollectionListSchemaResponse = z.object({
  items: z.array(
    z.object({
      id: IdSchema,
      userId: IdSchema,
      animeId: IdSchema,
      user: z.object({
        name: z.string()
      }),
      anime: z.object({
        name: z.string(),
        cover: z.string()
      }),
      createdAt: z.date()
    })
  ),
  total: z.number()
});
