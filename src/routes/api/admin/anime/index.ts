import type { FastifyInstance } from 'fastify';
import { SuccessResponseSchema } from '../../../../schemas/common.js';
import {
  type AddAnimeBody,
  AddAnimeSchema,
  type AnimeListQuery,
  AnimeListSchema,
  AnimeListSchemaResponse
} from '../../../../schemas/anime.js';

export default async function (fastify: FastifyInstance) {
  const {
    authenticate,
    rbac,
    seriesRepository,
    tagsRepository,
    animeRepository,
    log
  } = fastify;

  /** 创建番剧 */
  fastify.post<{ Body: AddAnimeBody }>(
    '/',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        body: AddAnimeSchema,
        response: {
          200: SuccessResponseSchema()
        }
      }
    },
    async (request, reply) => {
      const { seriesId, season, tags, ...rest } = request.body;

      const existingSeries = await seriesRepository.findById(seriesId);
      if (existingSeries.isErr()) {
        log.error({ error: existingSeries.error }, 'Failed to find series');
        return reply.internalServerError('创建番剧失败');
      }

      if (!existingSeries.value) {
        return reply.notFound('系列不存在');
      }

      const existingTags = await tagsRepository.findByIds(tags);
      if (existingTags.isErr()) {
        log.error({ error: existingTags.error }, 'Failed to find tags');
        return reply.internalServerError('创建番剧失败');
      }

      const existingTagsArr = existingTags.value;
      if (existingTagsArr.length !== tags.length) {
        const missingTags = tags.filter(
          id => !existingTagsArr.some(p => p.id === id)
        );
        return reply.notFound(`标签不存在：${missingTags.join(', ')}`);
      }

      const existingAnime = await animeRepository.findBySeriesAndSeason(
        seriesId,
        season
      );
      if (existingAnime.isErr()) {
        log.error({ error: existingAnime.error }, 'Failed to find anime');
        return reply.internalServerError('创建番剧失败');
      }

      if (existingAnime.value) {
        return reply.conflict('番剧已存在');
      }

      const result = await animeRepository.create({
        seriesId,
        season,
        tags,
        ...rest
      });

      if (result.isErr()) {
        log.error({ error: result.error }, 'Failed to create anime');
        return reply.internalServerError('创建番剧失败');
      }

      return reply.success('创建番剧成功');
    }
  );

  /** 番剧列表 */
  fastify.get<{ Querystring: AnimeListQuery }>(
    '/',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        querystring: AnimeListSchema,
        response: {
          200: SuccessResponseSchema(AnimeListSchemaResponse)
        }
      }
    },
    async (request, reply) => {
      const result = await animeRepository.findAll(request.query);

      if (result.isErr()) {
        log.error({ error: result.error }, 'Failed to get anime');
        return reply.internalServerError('获取番剧列表失败');
      }

      return reply.success('获取番剧列表成功', result.value);
    }
  );
}
