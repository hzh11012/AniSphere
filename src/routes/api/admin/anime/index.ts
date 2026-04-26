import type { FastifyInstance } from 'fastify';
import { SuccessResponseSchema } from '../../../../schemas/common.js';
import {
  type AddAnimeBody,
  AddAnimeSchema,
  type AnimeListQuery,
  AnimeListSchema,
  AnimeListSchemaResponse,
  type UpdateAnimeParams,
  UpdateAnimeParamsSchema,
  type UpdateAnimeBody,
  UpdateAnimeBodySchema
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

  /** 编辑番剧 */
  fastify.put<{ Params: UpdateAnimeParams; Body: UpdateAnimeBody }>(
    '/:id',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        params: UpdateAnimeParamsSchema,
        body: UpdateAnimeBodySchema,
        response: {
          200: SuccessResponseSchema()
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params;
      const { seriesId, season, tags, ...rest } = request.body;

      const existingAnime = await animeRepository.findById(id);
      if (existingAnime.isErr()) {
        log.error({ error: existingAnime.error }, 'Failed to find anime');
        return reply.internalServerError('编辑番剧失败');
      }

      if (!existingAnime.value) {
        return reply.notFound('番剧不存在');
      }

      if (seriesId !== undefined) {
        const existingSeries = await seriesRepository.findById(seriesId);
        if (existingSeries.isErr()) {
          log.error({ error: existingSeries.error }, 'Failed to find series');
          return reply.internalServerError('编辑番剧失败');
        }

        if (!existingSeries.value) {
          return reply.notFound('系列不存在');
        }
      }

      if (tags !== undefined) {
        const existingTags = await tagsRepository.findByIds(tags);
        if (existingTags.isErr()) {
          log.error({ error: existingTags.error }, 'Failed to find tags');
          return reply.internalServerError('编辑番剧失败');
        }

        const existingTagsArr = existingTags.value;
        if (existingTagsArr.length !== tags.length) {
          const missingTags = tags.filter(
            id => !existingTagsArr.some(p => p.id === id)
          );
          return reply.notFound(`标签不存在：${missingTags.join(', ')}`);
        }
      }

      if (seriesId !== undefined || season !== undefined) {
        const checkSeriesId = seriesId ?? existingAnime.value.seriesId;
        const checkSeason = season ?? existingAnime.value.season;
        const duplicate = await animeRepository.findBySeriesAndSeason(
          checkSeriesId,
          checkSeason
        );
        if (duplicate.isErr()) {
          log.error({ error: duplicate.error }, 'Failed to find anime');
          return reply.internalServerError('编辑番剧失败');
        }

        if (duplicate.value && duplicate.value.id !== id) {
          return reply.conflict('该系列下已存在相同季的番剧');
        }
      }

      const result = await animeRepository.update(id, {
        seriesId,
        season,
        tags,
        ...rest
      });

      if (result.isErr()) {
        log.error({ error: result.error }, 'Failed to update anime');
        return reply.internalServerError('编辑番剧失败');
      }

      return reply.success('编辑番剧成功');
    }
  );
}
