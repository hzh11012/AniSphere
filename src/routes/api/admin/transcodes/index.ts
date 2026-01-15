import type { FastifyInstance } from 'fastify';
import { SuccessResponseSchema } from '../../../../schemas/common.js';
import {
  type TranscodeBody,
  TranscodeSchema
} from '../../../../schemas/transcode.js';

export default async function (fastify: FastifyInstance) {
  const { authenticate, rbac, tasksRepository, ffmpegService, config, log } =
    fastify;

  /** 开启转码 */
  fastify.post<{ Body: TranscodeBody }>(
    '/',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        body: TranscodeSchema,
        response: {
          200: SuccessResponseSchema()
        }
      }
    },
    async (request, reply) => {
      const { id } = request.body;

      // 查找任务
      const taskResult = await tasksRepository.findById(id);
      if (taskResult.isErr()) {
        log.error({ error: taskResult.error }, 'Failed to find task');
        return reply.internalServerError('查找任务失败');
      }

      const task = taskResult.value;
      if (!task) {
        return reply.notFound('任务不存在');
      }

      // 检查任务状态
      if (task.status === 'transcoding') {
        return reply.badRequest('任务正在转码中');
      }

      if (task.status === 'transcoded' || task.status === 'completed') {
        return reply.badRequest('任务已完成转码');
      }

      // 异步执行转码
      ffmpegService.transcode({
        taskId: id,
        inputPath: task.filePath,
        outputDir: config.FFMPEG_TRANSCODE_OUTPUT_PATH
      });

      return reply.success('转码任务已创建');
    }
  );

  /** 取消转码 */
  fastify.delete<{ Params: TranscodeBody }>(
    '/:id',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        params: TranscodeSchema,
        response: {
          200: SuccessResponseSchema()
        }
      }
    },
    async (request, reply) => {
      const taskId = request.params.id;

      const result = await ffmpegService.cancelTranscode(taskId);

      if (result.isErr()) {
        return reply.notFound(result.error.message);
      }

      return reply.success('转码已取消');
    }
  );
}
