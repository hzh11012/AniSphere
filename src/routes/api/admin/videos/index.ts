import type { FastifyInstance } from 'fastify';
import { SuccessResponseSchema } from '../../../../schemas/common.js';
import {
  type VideoListQuery,
  VideoListSchema,
  VideoListSchemaResponse,
  type AddVideoBody,
  AddVideoSchema,
  type UpdateVideoParams,
  UpdateVideoParamsSchema,
  type UpdateVideoBody,
  UpdateVideoBodySchema,
  type DeleteVideoParams,
  DeleteVideoParamsSchema
} from '../../../../schemas/videos.js';

export default async function (fastify: FastifyInstance) {
  const { authenticate, rbac, videosRepository, animeRepository, log } =
    fastify;

  /** 创建剧集 */
  fastify.post<{ Body: AddVideoBody }>(
    '/',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        body: AddVideoSchema,
        response: {
          200: SuccessResponseSchema()
        }
      }
    },
    async (request, reply) => {
      const { animeId, episode } = request.body;

      const existingAnime = await animeRepository.findById(animeId);
      if (existingAnime.isErr()) {
        log.error({ error: existingAnime.error }, 'Failed to find anime');
        return reply.internalServerError('创建剧集失败');
      }

      if (!existingAnime.value) {
        return reply.notFound('动漫不存在');
      }

      const existingVideo = await videosRepository.findByAnimeIdAndEpisode(
        animeId,
        episode
      );
      if (existingVideo.isErr()) {
        log.error({ error: existingVideo.error }, 'Failed to find video');
        return reply.internalServerError('创建剧集失败');
      }

      if (existingVideo.value) {
        return reply.conflict('该番剧已存在相同集数的剧集');
      }

      const result = await videosRepository.create(request.body);

      if (result.isErr()) {
        log.error({ error: result.error }, 'Failed to create video');
        return reply.internalServerError('创建剧集失败');
      }

      return reply.success('创建剧集成功');
    }
  );

  /** 获取剧集列表 */
  fastify.get<{ Querystring: VideoListQuery }>(
    '/',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        querystring: VideoListSchema,
        response: {
          200: SuccessResponseSchema(VideoListSchemaResponse)
        }
      }
    },
    async (request, reply) => {
      const result = await videosRepository.findAll(request.query);

      if (result.isErr()) {
        log.error({ error: result.error }, 'Failed to get videos');
        return reply.internalServerError('获取剧集列表失败');
      }

      return reply.success('获取剧集列表成功', result.value);
    }
  );

  /** 编辑剧集 */
  fastify.put<{ Params: UpdateVideoParams; Body: UpdateVideoBody }>(
    '/:id',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        params: UpdateVideoParamsSchema,
        body: UpdateVideoBodySchema,
        response: {
          200: SuccessResponseSchema()
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params;

      const existingVideo = await videosRepository.findById(id);
      if (existingVideo.isErr()) {
        log.error({ error: existingVideo.error }, 'Failed to find video');
        return reply.internalServerError('编辑剧集失败');
      }

      if (!existingVideo.value) {
        return reply.notFound('剧集不存在');
      }

      if (request.body.animeId !== undefined) {
        const existingAnime = await animeRepository.findById(
          request.body.animeId
        );
        if (existingAnime.isErr()) {
          log.error({ error: existingAnime.error }, 'Failed to find anime');
          return reply.internalServerError('编辑剧集失败');
        }

        if (!existingAnime.value) {
          return reply.notFound('动漫不存在');
        }
      }

      // 检查是否有重复的 animeId + episode 组合
      const checkAnimeId = request.body.animeId ?? existingVideo.value.animeId;
      const checkEpisode = request.body.episode ?? existingVideo.value.episode;

      // 只有当 animeId 或 episode 发生变化时才检查重复
      if (
        request.body.animeId !== undefined ||
        request.body.episode !== undefined
      ) {
        const duplicateVideo = await videosRepository.findByAnimeIdAndEpisode(
          checkAnimeId,
          checkEpisode
        );
        if (duplicateVideo.isErr()) {
          log.error({ error: duplicateVideo.error }, 'Failed to find video');
          return reply.internalServerError('编辑剧集失败');
        }

        if (duplicateVideo.value && duplicateVideo.value.id !== id) {
          return reply.conflict('该动漫已存在相同集数的剧集');
        }
      }

      const result = await videosRepository.update(id, request.body);

      if (result.isErr()) {
        log.error({ error: result.error }, 'Failed to update video');
        return reply.internalServerError('编辑剧集失败');
      }

      return reply.success('编辑剧集成功');
    }
  );

  /** 删除剧集 */
  fastify.delete<{ Params: DeleteVideoParams }>(
    '/:id',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        params: DeleteVideoParamsSchema,
        response: {
          200: SuccessResponseSchema()
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params;

      const result = await videosRepository.deleteById(id);

      if (result.isErr()) {
        log.error({ error: result.error }, 'Failed to delete video');
        return reply.internalServerError('删除剧集失败');
      }

      if (!result.value) {
        return reply.notFound('剧集不存在');
      }

      return reply.success('删除剧集成功');
    }
  );
}
