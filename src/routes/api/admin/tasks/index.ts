import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { SuccessResponseSchema } from '../../../../schemas/common.js';
import {
  type TaskListQuery,
  TaskListSchema,
  TaskListSchemaResponse,
  type DeleteTaskBody,
  DeleteTaskSchema,
  IngestTaskSchema,
  type IngestTaskBody
} from '../../../../schemas/webhook.js';

export default async function (fastify: FastifyInstance) {
  const { authenticate, rbac, tasksRepository, config, log } = fastify;

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

  /** 删除任务记录 */
  fastify.delete<{ Params: DeleteTaskBody }>(
    '/:id',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        params: DeleteTaskSchema,
        response: {
          200: SuccessResponseSchema()
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params;

      const existing = await tasksRepository.findById(id);
      if (existing.isErr()) {
        log.error({ error: existing.error }, 'Failed to find task');
        return reply.internalServerError('删除任务记录失败');
      }

      if (!existing.value) {
        return reply.notFound('任务记录不存在');
      }

      const result = await tasksRepository.deleteById(id);

      if (result.isErr()) {
        log.error({ error: result.error }, 'Failed to delete task');
        return reply.internalServerError('删除任务记录失败');
      }

      return reply.success('删除任务记录成功');
    }
  );

  /** 入库：将转码完成的文件移动到指定目录 */
  fastify.post<{ Body: IngestTaskBody }>(
    '/ingest',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        body: IngestTaskSchema,
        response: {
          200: SuccessResponseSchema()
        }
      }
    },
    async (request, reply) => {
      const { id, path: destination } = request.body;
      const rootDir = config.RESOURCE_ROOT_PATH;

      // 安全检查：目标路径必须在资源根目录下
      const resolvedDest = path.resolve(rootDir, destination);
      if (!resolvedDest.startsWith(path.resolve(rootDir))) {
        return reply.badRequest('非法目标路径');
      }

      // 查找任务
      const taskResult = await tasksRepository.findById(id);
      if (taskResult.isErr()) {
        log.error({ error: taskResult.error }, 'Failed to find task');
        return reply.internalServerError('入库失败');
      }

      const task = taskResult.value;
      if (!task) {
        return reply.notFound('任务不存在');
      }

      if (task.status !== 'transcoded') {
        return reply.badRequest('任务未完成转码');
      }

      if (!task.transcodeOutputPath) {
        return reply.badRequest('转码输出路径为空');
      }

      const sourcePath = task.transcodeOutputPath;
      try {
        await fs.rename(sourcePath, resolvedDest);
      } catch (e: any) {
        if (e.code !== 'EXDEV') throw e;
        await fs.mkdir(path.dirname(resolvedDest), { recursive: true });
        await fs.cp(sourcePath, resolvedDest, { recursive: true });
        await fs.rm(sourcePath, { recursive: true, force: true });
      }

      // 标记任务为已完成
      const updateResult = await tasksRepository.markCompleted(id);
      if (updateResult.isErr()) {
        log.error(
          { error: updateResult.error },
          'Failed to mark task completed'
        );
        return reply.internalServerError('更新任务状态失败');
      }

      return reply.success('入库成功');
    }
  );
}
