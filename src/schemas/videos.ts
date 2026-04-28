import { z } from 'zod';
import { IdSchema, PaginationQuerySchema } from './common.js';

export const VideoListSchema = z.preprocess(
  val => val ?? {},
  z.object({
    ...PaginationQuerySchema,
    keyword: z.string().optional(),
    sort: z.enum(['createdAt', 'episode', 'views']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc')
  })
);

export type VideoListQuery = z.infer<typeof VideoListSchema>;

export const AddVideoSchema = z.object({
  animeId: IdSchema,
  title: z.string().min(1).max(100),
  episode: z.coerce.number().positive(),
  url: z.string().min(1).max(255)
});

export type AddVideoBody = z.infer<typeof AddVideoSchema>;

export const UpdateVideoParamsSchema = z.object({
  id: IdSchema
});

export type UpdateVideoParams = z.infer<typeof UpdateVideoParamsSchema>;

export const UpdateVideoBodySchema = z.object({
  animeId: IdSchema.optional(),
  title: z.string().min(1).max(100).optional(),
  episode: z.coerce.number().positive().optional(),
  url: z.string().min(1).max(255).optional()
});

export type UpdateVideoBody = z.infer<typeof UpdateVideoBodySchema>;

export const DeleteVideoParamsSchema = z.object({
  id: IdSchema
});

export type DeleteVideoParams = z.infer<typeof DeleteVideoParamsSchema>;

export const VideoListSchemaResponse = z.object({
  items: z.array(
    z.object({
      id: IdSchema,
      animeId: IdSchema,
      anime: z.object({
        name: z.string(),
        cover: z.string()
      }),
      title: z.string(),
      episode: z.number(),
      url: z.string(),
      views: z.number(),
      createdAt: z.date()
    })
  ),
  total: z.number()
});
