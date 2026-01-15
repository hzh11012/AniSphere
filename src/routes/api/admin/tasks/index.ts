import type { FastifyInstance } from 'fastify';
import { SuccessResponseSchema } from '../../../../schemas/common.js';
import {
  type TaskListQuery,
  TaskListSchema,
  TaskListSchemaResponse
} from '../../../../schemas/webhook.js';

export default async function (fastify: FastifyInstance) {
  const { authenticate, rbac, tasksRepository, log } = fastify;

  /** 任务列表 */
  fastify.get<{ Querystring: TaskListQuery }>(
    '/',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        querystring: TaskListSchema,
        response: {
          200: SuccessResponseSchema(TaskListSchemaResponse)
        }
      }
    },
    async (request, reply) => {
      const { page, pageSize, keyword, status, sort, order } = request.query;

      const result = await tasksRepository.findAll({
        page,
        pageSize,
        keyword,
        status,
        sort,
        order
      });

      if (result.isErr()) {
        log.error({ error: result.error }, 'Failed to get tasks');
        return reply.internalServerError('获取任务列表失败');
      }

      return reply.success('获取任务列表成功', result.value);
    }
  );
}
