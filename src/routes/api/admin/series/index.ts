import type { FastifyInstance } from 'fastify';
import { SuccessResponseSchema } from '../../../../schemas/common.js';
import {
  type AddSeriesBody,
  AddSeriesSchema,
  type SeriesListQuery,
  SeriesListSchema,
  SeriesListSchemaResponse,
  type DeleteSeriesBody,
  DeleteSeriesSchema
} from '../../../../schemas/series.js';

export default async function (fastify: FastifyInstance) {
  const { authenticate, rbac, seriesRepository, log } = fastify;

  /** 创建系列 */
  fastify.post<{ Body: AddSeriesBody }>(
    '/',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        body: AddSeriesSchema,
        response: {
          200: SuccessResponseSchema()
        }
      }
    },
    async (request, reply) => {
      const { name } = request.body;

      const existing = await seriesRepository.findByName(name);
      if (existing.isErr()) {
        log.error({ error: existing.error }, 'Failed to find series');
        return reply.internalServerError('创建系列失败');
      }

      if (existing.value) {
        return reply.conflict('系列已存在');
      }

      const result = await seriesRepository.create({
        name
      });

      if (result.isErr()) {
        log.error({ error: result.error }, 'Failed to create series');
        return reply.internalServerError('创建系列失败');
      }

      return reply.success('创建系列成功');
    }
  );

  /** 系列列表 */
  fastify.get<{ Querystring: SeriesListQuery }>(
    '/',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        querystring: SeriesListSchema,
        response: {
          200: SuccessResponseSchema(SeriesListSchemaResponse)
        }
      }
    },
    async (request, reply) => {
      const { page, pageSize, keyword, sort, order } = request.query;

      const result = await seriesRepository.findAll({
        page,
        pageSize,
        keyword,
        sort,
        order
      });

      if (result.isErr()) {
        log.error({ error: result.error }, 'Failed to get series');
        return reply.internalServerError('获取系列列表失败');
      }

      return reply.success('获取系列列表成功', result.value);
    }
  );

  /** 删除系列 */
  fastify.delete<{ Params: DeleteSeriesBody }>(
    '/:id',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        params: DeleteSeriesSchema,
        response: {
          200: SuccessResponseSchema()
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params;

      const existing = await seriesRepository.findById(id);
      if (existing.isErr()) {
        log.error({ error: existing.error }, 'Failed to find series');
        return reply.internalServerError('删除系列失败');
      }

      if (!existing.value) {
        return reply.notFound('系列不存在');
      }

      const result = await seriesRepository.deleteById(id);

      if (result.isErr()) {
        log.error({ error: result.error }, 'Failed to delete series');
        return reply.internalServerError('删除系列失败');
      }

      return reply.success('删除系列成功');
    }
  );
}
