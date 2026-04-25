import { z } from 'zod';
import { IdSchema, PaginationQuerySchema } from './common.js';

export const AddAnimeSchema = z.object({
  seriesId: IdSchema,
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  remark: z.string().min(1).max(25),
  cover: z.string().min(1).max(255),
  banner: z.string().min(1).max(255),
  status: z.enum(['draft', 'upcoming', 'airing', 'completed']),
  type: z.enum(['movie', 'japanese', 'american', 'chinese', 'adult']),
  year: z.coerce.number().min(1990).max(new Date().getFullYear()),
  month: z.enum(['january', 'april', 'july', 'october']),
  director: z.string().min(1).max(25),
  cv: z.string().min(1).max(1000),
  season: z.coerce.number().min(1).max(100),
  seasonName: z.string().min(1).max(25).optional(),
  tags: z.array(IdSchema).min(1)
});

export type AddAnimeBody = z.infer<typeof AddAnimeSchema>;

export const UpdateAnimeSchema = z.object({
  id: IdSchema,
  seriesId: IdSchema.optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(1000).optional(),
  remark: z.string().min(1).max(25).optional(),
  cover: z.string().min(1).max(255).optional(),
  banner: z.string().min(1).max(255).optional(),
  status: z.enum(['draft', 'upcoming', 'airing', 'completed']).optional(),
  type: z
    .enum(['movie', 'japanese', 'american', 'chinese', 'adult'])
    .optional(),
  year: z.coerce.number().min(1990).max(new Date().getFullYear()).optional(),
  month: z.enum(['january', 'april', 'july', 'october']).optional(),
  director: z.string().min(1).max(25).optional(),
  cv: z.string().min(1).max(1000).optional(),
  season: z.coerce.number().min(1).max(100).optional(),
  seasonName: z.string().min(1).max(25).optional(),
  tags: z.array(IdSchema).min(1).optional()
});

export type UpdateAnimeBody = z.infer<typeof UpdateAnimeSchema>;

export const AnimeListSchema = z.preprocess(
  val => val ?? {},
  z.object({
    ...PaginationQuerySchema,
    keyword: z.string().optional(),
    sort: z.enum(['createdAt']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
    status: z
      .array(z.enum(['draft', 'upcoming', 'airing', 'completed']))
      .optional(),
    types: z
      .array(z.enum(['movie', 'japanese', 'american', 'chinese', 'adult']))
      .optional(),
    tags: z.array(IdSchema).optional(),
    years: z
      .array(
        z
          .enum(
            Array.from({ length: new Date().getFullYear() - 1988 }, (_, i) =>
              String(1990 + i)
            )
          )
          .transform(val => parseInt(val, 10))
      )
      .optional(),
    months: z.array(z.enum(['january', 'april', 'july', 'october'])).optional()
  })
);

export type AnimeListQuery = z.infer<typeof AnimeListSchema>;

export const AnimeListSchemaResponse = z.object({
  items: z.array(
    z.object({
      id: IdSchema,
      seriesId: IdSchema,
      name: z.string(),
      description: z.string(),
      remark: z.string(),
      cover: z.string(),
      banner: z.string(),
      status: z.enum(['draft', 'upcoming', 'airing', 'completed']),
      type: z.enum(['movie', 'japanese', 'american', 'chinese', 'adult']),
      year: z.number(),
      month: z.enum(['january', 'april', 'july', 'october']),
      director: z.string(),
      cv: z.string(),
      season: z.number(),
      seasonName: z.string().nullable(),
      avgScore: z.number(),
      scoreCount: z.number(),
      tags: z.array(
        z.object({
          id: IdSchema,
          name: z.string()
        })
      ),
      createdAt: z.date()
    })
  ),
  total: z.number()
});
