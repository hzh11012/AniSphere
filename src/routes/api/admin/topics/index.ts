import type { FastifyInstance } from 'fastify';
import { SuccessResponseSchema } from '../../../../schemas/common.js';
import {
  type TopicListQuery,
  TopicListSchema,
  TopicListSchemaResponse,
  type AddTopicBody,
  AddTopicSchema,
  type UpdateTopicParams,
  UpdateTopicParamsSchema,
  type UpdateTopicBody,
  UpdateTopicBodySchema,
  type DeleteTopicParams,
  DeleteTopicParamsSchema
} from '../../../../schemas/topics.js';

export default async function (fastify: FastifyInstance) {
  const { authenticate, rbac, topicsRepository, log } = fastify;

  /** 创建专题 */
  fastify.post<{ Body: AddTopicBody }>(
    '/',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        body: AddTopicSchema,
        response: {
          200: SuccessResponseSchema()
        }
      }
    },
    async (request, reply) => {
      const { name } = request.body;

      const existing = await topicsRepository.findByName(name);
      if (existing.isErr()) {
        log.error({ error: existing.error }, 'Failed to find topic');
        return reply.internalServerError('创建专题失败');
      }

      if (existing.value) {
        return reply.conflict('专题名已存在');
      }

      const result = await topicsRepository.create(request.body);

      if (result.isErr()) {
        log.error({ error: result.error }, 'Failed to create topic');
        return reply.internalServerError('创建专题失败');
      }

      return reply.success('创建专题成功');
    }
  );

  /** 获取专题列表 */
  fastify.get<{ Querystring: TopicListQuery }>(
    '/',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        querystring: TopicListSchema,
        response: {
          200: SuccessResponseSchema(TopicListSchemaResponse)
        }
      }
    },
    async (request, reply) => {
      const result = await topicsRepository.findAll(request.query);

      if (result.isErr()) {
        log.error({ error: result.error }, 'Failed to get topics');
        return reply.internalServerError('获取专题列表失败');
      }

      return reply.success('获取专题列表成功', result.value);
    }
  );

  /** 编辑专题 */
  fastify.put<{ Params: UpdateTopicParams; Body: UpdateTopicBody }>(
    '/:id',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        params: UpdateTopicParamsSchema,
        body: UpdateTopicBodySchema,
        response: {
          200: SuccessResponseSchema()
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params;

      const existing = await topicsRepository.findById(id);
      if (existing.isErr()) {
        log.error({ error: existing.error }, 'Failed to find topic');
        return reply.internalServerError('编辑专题失败');
      }

      if (!existing.value) {
        return reply.notFound('专题不存在');
      }

      if (request.body.name !== undefined) {
        const duplicate = await topicsRepository.findByName(request.body.name);
        if (duplicate.isErr()) {
          log.error({ error: duplicate.error }, 'Failed to find topic');
          return reply.internalServerError('编辑专题失败');
        }

        if (duplicate.value && duplicate.value.id !== id) {
          return reply.conflict('专题名已存在');
        }
      }

      const result = await topicsRepository.update(id, request.body);

      if (result.isErr()) {
        log.error({ error: result.error }, 'Failed to update topic');
        return reply.internalServerError('编辑专题失败');
      }

      return reply.success('编辑专题成功');
    }
  );

  /** 删除专题 */
  fastify.delete<{ Params: DeleteTopicParams }>(
    '/:id',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        params: DeleteTopicParamsSchema,
        response: {
          200: SuccessResponseSchema()
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params;

      const result = await topicsRepository.deleteById(id);

      if (result.isErr()) {
        log.error({ error: result.error }, 'Failed to delete topic');
        return reply.internalServerError('删除专题失败');
      }

      if (!result.value) {
        return reply.notFound('专题不存在');
      }

      return reply.success('删除专题成功');
    }
  );
}
