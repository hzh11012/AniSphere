import type { FastifyInstance } from 'fastify';
import { SuccessResponseSchema } from '../../../../schemas/common.js';
import { DashboardStatsSchemaResponse } from '../../../../schemas/dashboard.js';

export default async function (fastify: FastifyInstance) {
  const { authenticate, rbac, dashboardRepository, log } = fastify;

  fastify.get(
    '/stats',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        response: { 200: SuccessResponseSchema(DashboardStatsSchemaResponse) }
      }
    },
    async (_request, reply) => {
      const result = await dashboardRepository.getStats();

      if (result.isErr()) {
        log.error({ error: result.error }, 'Failed to get dashboard stats');
        return reply.internalServerError('获取仪表盘数据失败');
      }

      return reply.success('获取仪表盘数据成功', result.value);
    }
  );
}
