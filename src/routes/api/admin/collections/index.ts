import type { FastifyInstance } from 'fastify';
import { SuccessResponseSchema } from '../../../../schemas/common.js';
import {
  type CollectionListQuery,
  CollectionListSchema,
  CollectionListSchemaResponse,
  type DeleteCollectionParams,
  DeleteCollectionParamsSchema
} from '../../../../schemas/collections.js';

export default async function (fastify: FastifyInstance) {
  const { authenticate, rbac, collectionsRepository, log } = fastify;

  /** 获取追番列表 */
  fastify.get<{ Querystring: CollectionListQuery }>(
    '/',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        querystring: CollectionListSchema,
        response: {
          200: SuccessResponseSchema(CollectionListSchemaResponse)
        }
      }
    },
    async (request, reply) => {
      const result = await collectionsRepository.findAll(request.query);

      if (result.isErr()) {
        log.error({ error: result.error }, 'Failed to get collections');
        return reply.internalServerError('获取追番列表失败');
      }

      return reply.success('获取追番列表成功', result.value);
    }
  );

  /** 删除追番 */
  fastify.delete<{ Params: DeleteCollectionParams }>(
    '/:id',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        params: DeleteCollectionParamsSchema,
        response: {
          200: SuccessResponseSchema()
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params;

      const result = await collectionsRepository.deleteById(id);

      if (result.isErr()) {
        log.error({ error: result.error }, 'Failed to delete collection');
        return reply.internalServerError('删除追番失败');
      }

      if (!result.value) {
        return reply.notFound('追番不存在');
      }

      return reply.success('删除追番成功');
    }
  );
}
