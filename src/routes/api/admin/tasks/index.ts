import type { FastifyInstance } from 'fastify';
import {
  DownloadSchema,
  TaskSchema,
  type DownloadParams,
  type TaskBody
} from '../../../../schemas/task.js';
import { SuccessResponseSchema } from '../../../../schemas/common.js';

export default async function (fastify: FastifyInstance) {
  /** 创建任务 */
  fastify.post<{ Body: TaskBody }>(
    '/',
    {
      schema: {
        body: TaskSchema,
        response: {
          200: SuccessResponseSchema()
        }
      }
    },
    async (request, reply) => {
      const { torrentUrl } = request.body;

      // 检查重复
      const existsResult =
        await fastify.tasksRepository.existsByTorrentUrl(torrentUrl);
      if (existsResult.isErr()) {
        fastify.log.error(
          { error: existsResult.error },
          'Failed to check for duplicate task'
        );
        return reply.internalServerError('服务器错误');
      }
      if (existsResult.isOk() && existsResult.value) {
        return reply.conflict('该种子已存在，请勿重复添加');
      }

      const taskResult = await fastify.tasksRepository.create(torrentUrl);

      if (taskResult.isErr()) {
        fastify.log.error({ error: taskResult.error }, 'Failed to create task');
        return reply.internalServerError('服务器错误');
      }

      return reply.success('创建任务成功');
    }
  );

  /** 开始下载 */
  fastify.post<{ Params: DownloadParams }>(
    '/:id/download',
    {
      schema: {
        params: DownloadSchema,
        response: {
          200: SuccessResponseSchema()
        }
      }
    },
    async (request, reply) => {
      const taskResult = await fastify.tasksRepository.findById(
        request.params.id
      );
      if (taskResult.isErr()) {
        fastify.log.error({ error: taskResult.error }, 'Failed to find task');
        return reply.internalServerError('服务器错误');
      }

      if (!taskResult.value) return reply.notFound('任务不存在');

      const task = taskResult.value;
      if (task.status !== 'pending') {
        return reply.badRequest('无法开始下载，请检查任务状态');
      }

      const addResult = await fastify.qbit.addTorrent(task.torrentUrl);
      if (addResult.isErr()) {
        fastify.log.error(
          { error: addResult.error, taskId: task.id },
          'Failed to add torrent'
        );
        await fastify.tasksRepository.markFailed(
          task.id,
          addResult.error.message,
          'pending'
        );
        return reply.badRequest('种子添加失败');
      }

      const downloadResult = await fastify.tasksRepository.startDownload(
        task.id,
        addResult.value
      );

      if (downloadResult.isErr()) {
        fastify.log.error(
          { error: downloadResult.error },
          'Failed to start download'
        );
        return reply.internalServerError('服务器错误');
      }

      return reply.success('开始下载');
    }
  );
}
