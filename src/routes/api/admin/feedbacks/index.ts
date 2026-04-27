import type { FastifyInstance } from 'fastify';
import { SuccessResponseSchema } from '../../../../schemas/common.js';
import {
  type FeedbackListQuery,
  FeedbackListSchema,
  FeedbackListSchemaResponse,
  type UpdateFeedbackParams,
  UpdateFeedbackParamsSchema,
  type UpdateFeedbackBody,
  UpdateFeedbackBodySchema,
  type DeleteFeedbackParams,
  DeleteFeedbackParamsSchema
} from '../../../../schemas/feedback.js';

export default async function (fastify: FastifyInstance) {
  const { authenticate, rbac, feedbackRepository, log } = fastify;

  /** 获取反馈列表 */
  fastify.get<{ Querystring: FeedbackListQuery }>(
    '/',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        querystring: FeedbackListSchema,
        response: {
          200: SuccessResponseSchema(FeedbackListSchemaResponse)
        }
      }
    },
    async (request, reply) => {
      const result = await feedbackRepository.findAll(request.query);

      if (result.isErr()) {
        log.error({ error: result.error }, 'Failed to get feedbacks');
        return reply.internalServerError('获取反馈列表失败');
      }

      return reply.success('获取反馈列表成功', result.value);
    }
  );

  /** 编辑反馈 */
  fastify.put<{ Params: UpdateFeedbackParams; Body: UpdateFeedbackBody }>(
    '/:id',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        params: UpdateFeedbackParamsSchema,
        body: UpdateFeedbackBodySchema,
        response: {
          200: SuccessResponseSchema()
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params;

      const existing = await feedbackRepository.findById(id);
      if (existing.isErr()) {
        log.error({ error: existing.error }, 'Failed to find feedback');
        return reply.internalServerError('编辑反馈失败');
      }

      if (!existing.value) {
        return reply.notFound('反馈不存在');
      }

      const result = await feedbackRepository.update(id, request.body);

      if (result.isErr()) {
        log.error({ error: result.error }, 'Failed to update feedback');
        return reply.internalServerError('编辑反馈失败');
      }

      return reply.success('编辑反馈成功');
    }
  );

  /** 删除反馈 */
  fastify.delete<{ Params: DeleteFeedbackParams }>(
    '/:id',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        params: DeleteFeedbackParamsSchema,
        response: {
          200: SuccessResponseSchema()
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params;

      const result = await feedbackRepository.deleteById(id);

      if (result.isErr()) {
        log.error({ error: result.error }, 'Failed to delete feedback');
        return reply.internalServerError('删除反馈失败');
      }

      if (!result.value) {
        return reply.notFound('反馈不存在');
      }

      return reply.success('删除反馈成功');
    }
  );
}
