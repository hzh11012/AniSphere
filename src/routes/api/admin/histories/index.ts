import type { FastifyInstance } from 'fastify';
import { SuccessResponseSchema } from '../../../../schemas/common.js';
import {
  type HistoryListQuery,
  HistoryListSchema,
  HistoryListSchemaResponse,
  type DeleteHistoryParams,
  DeleteHistoryParamsSchema
} from '../../../../schemas/histories.js';

export default async function (fastify: FastifyInstance) {
  const { authenticate, rbac, historiesRepository, log } = fastify;

  /** 获取观看记录列表 */
  fastify.get<{ Querystring: HistoryListQuery }>(
    '/',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        querystring: HistoryListSchema,
        response: {
          200: SuccessResponseSchema(HistoryListSchemaResponse)
        }
      }
    },
    async (request, reply) => {
      const result = await historiesRepository.findAll(request.query);

      if (result.isErr()) {
        log.error({ error: result.error }, 'Failed to get histories');
        return reply.internalServerError('获取观看记录列表失败');
      }

      return reply.success('获取观看记录列表成功', result.value);
    }
  );

  /** 删除观看记录 */
  fastify.delete<{ Params: DeleteHistoryParams }>(
    '/:id',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        params: DeleteHistoryParamsSchema,
        response: {
          200: SuccessResponseSchema()
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params;

      const result = await historiesRepository.deleteById(id);

      if (result.isErr()) {
        log.error({ error: result.error }, 'Failed to delete history');
        return reply.internalServerError('删除观看记录失败');
      }

      if (!result.value) {
        return reply.notFound('观看记录不存在');
      }

      return reply.success('删除观看记录成功');
    }
  );
}
