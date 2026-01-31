import { z } from 'zod';
import { IdSchema, PaginationQuerySchema } from './common.js';

export const AddSeriesSchema = z.object({
  name: z.string().min(1).max(100)
});

export type AddSeriesBody = z.infer<typeof AddSeriesSchema>;

export const SeriesListSchema = z.preprocess(
  val => val ?? {},
  z.object({
    ...PaginationQuerySchema,
    keyword: z.string().optional(),
    sort: z.enum(['createdAt']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc')
  })
);

export const SeriesListSchemaResponse = z.object({
  items: z.array(
    z.object({
      id: IdSchema,
      name: z.string(),
      anime: z.array(
        z.object({
          name: z.string(),
          season: z.string()
        })
      ),
      createdAt: z.date()
    })
  ),
  total: z.number()
});

export type SeriesListQuery = z.infer<typeof SeriesListSchema>;

export const DeleteSeriesSchema = z.object({
  id: IdSchema
});

export type DeleteSeriesBody = z.infer<typeof DeleteSeriesSchema>;
