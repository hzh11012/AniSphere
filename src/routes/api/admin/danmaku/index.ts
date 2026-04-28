import type { FastifyInstance } from 'fastify';
import { SuccessResponseSchema } from '../../../../schemas/common.js';
import {
  type DanmakuListQuery,
  DanmakuListSchema,
  DanmakuListSchemaResponse,
  type DeleteDanmakuParams,
  DeleteDanmakuParamsSchema
} from '../../../../schemas/danmaku.js';

export default async function (fastify: FastifyInstance) {
  const { authenticate, rbac, danmakuRepository, log } = fastify;

  /** 获取弹幕列表 */
  fastify.get<{ Querystring: DanmakuListQuery }>(
    '/',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        querystring: DanmakuListSchema,
        response: {
          200: SuccessResponseSchema(DanmakuListSchemaResponse)
        }
      }
    },
    async (request, reply) => {
      const result = await danmakuRepository.findAll(request.query);

      if (result.isErr()) {
        log.error({ error: result.error }, 'Failed to get danmaku');
        return reply.internalServerError('获取弹幕列表失败');
      }

      return reply.success('获取弹幕列表成功', result.value);
    }
  );

  /** 删除弹幕 */
  fastify.delete<{ Params: DeleteDanmakuParams }>(
    '/:id',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        params: DeleteDanmakuParamsSchema,
        response: {
          200: SuccessResponseSchema()
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params;

      const result = await danmakuRepository.deleteById(id);

      if (result.isErr()) {
        log.error({ error: result.error }, 'Failed to delete danmaku');
        return reply.internalServerError('删除弹幕失败');
      }

      if (!result.value) {
        return reply.notFound('弹幕不存在');
      }

      return reply.success('删除弹幕成功');
    }
  );
}
