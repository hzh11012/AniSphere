import type { FastifyInstance } from 'fastify';
import { SuccessResponseSchema } from '../../../../schemas/common.js';
import {
  type ScoreListQuery,
  ScoreListSchema,
  ScoreListSchemaResponse,
  type DeleteScoreParams,
  DeleteScoreParamsSchema,
  type UpdateScoreParams,
  UpdateScoreParamsSchema,
  type UpdateScoreBody,
  UpdateScoreBodySchema
} from '../../../../schemas/scores.js';

export default async function (fastify: FastifyInstance) {
  const { authenticate, rbac, scoresRepository, log } = fastify;

  /** 获取评分列表 */
  fastify.get<{ Querystring: ScoreListQuery }>(
    '/',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        querystring: ScoreListSchema,
        response: {
          200: SuccessResponseSchema(ScoreListSchemaResponse)
        }
      }
    },
    async (request, reply) => {
      const result = await scoresRepository.findAll(request.query);

      if (result.isErr()) {
        log.error({ error: result.error }, 'Failed to get scores');
        return reply.internalServerError('获取评分列表失败');
      }

      return reply.success('获取评分列表成功', result.value);
    }
  );

  /** 更新评分 */
  fastify.put<{ Params: UpdateScoreParams; Body: UpdateScoreBody }>(
    '/:id',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        params: UpdateScoreParamsSchema,
        body: UpdateScoreBodySchema,
        response: {
          200: SuccessResponseSchema()
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params;

      const existing = await scoresRepository.findById(id);
      if (existing.isErr()) {
        log.error({ error: existing.error }, 'Failed to find score');
        return reply.internalServerError('更新评分失败');
      }

      if (!existing.value) {
        return reply.notFound('评分不存在');
      }

      const result = await scoresRepository.update(id, request.body);

      if (result.isErr()) {
        log.error({ error: result.error }, 'Failed to update score');
        return reply.internalServerError('更新评分失败');
      }

      return reply.success('更新评分成功');
    }
  );

  /** 删除评分 */
  fastify.delete<{ Params: DeleteScoreParams }>(
    '/:id',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        params: DeleteScoreParamsSchema,
        response: {
          200: SuccessResponseSchema()
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params;

      const result = await scoresRepository.deleteById(id);

      if (result.isErr()) {
        log.error({ error: result.error }, 'Failed to delete score');
        return reply.internalServerError('删除评分失败');
      }

      if (!result.value) {
        return reply.notFound('评分不存在');
      }

      return reply.success('删除评分成功');
    }
  );
}
