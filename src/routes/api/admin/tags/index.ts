import type { FastifyInstance } from 'fastify';
import {
  SuccessResponseSchema,
  OptionSchemaResponse
} from '../../../../schemas/common.js';
import {
  TagsListSchema,
  TagsListSchemaResponse,
  type TagsListQuery
} from '../../../../schemas/tags.js';

export default async function (fastify: FastifyInstance) {
  const { authenticate, rbac, tagsRepository, log } = fastify;

  /** 标签列表 */
  fastify.get<{ Querystring: TagsListQuery }>(
    '/',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        querystring: TagsListSchema,
        response: {
          200: SuccessResponseSchema(TagsListSchemaResponse)
        }
      }
    },
    async (request, reply) => {
      const { page, pageSize, keyword, sort, order } = request.query;

      const result = await tagsRepository.findAll({
        page,
        pageSize,
        keyword,
        sort,
        order
      });

      if (result.isErr()) {
        log.error({ error: result.error }, 'Failed to get tags');
        return reply.internalServerError('获取标签列表失败');
      }

      return reply.success('获取标签列表成功', result.value);
    }
  );

  /** 标签选项 */
  fastify.get(
    '/options',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        response: {
          200: SuccessResponseSchema(OptionSchemaResponse)
        }
      }
    },
    async (request, reply) => {
      const result = await tagsRepository.findAllOptions();

      if (result.isErr()) {
        log.error({ error: result.error }, 'Failed to get tags options');
        return reply.internalServerError('获取标签选项失败');
      }

      return reply.success('获取标签选项成功', result.value);
    }
  );
}
