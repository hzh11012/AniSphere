import type { FastifyInstance } from 'fastify';
import { isVideoFile, needsTranscode } from '../../../utils/video.js';
import { WebhookQuery, WebhookSchema } from '../../../schemas/webhook.js';

export default async function (fastify: FastifyInstance) {
  const { tasksRepository, qbit, log } = fastify;

  /**
   * qBittorrent 下载完成 Webhook
   *
   * 配置：qBit 设置 -> 下载 -> 下载完成时运行外部程序
   * 填入：curl -X POST "http://localhost:3000/api/webhook/qbit?hash=%I&tag=%G"
   */
  fastify.post<{ Querystring: WebhookQuery }>(
    '/qbit',
    {
      schema: { querystring: WebhookSchema }
    },
    async (request, reply) => {
      const { hash, tag } = request.query;

      if (tag !== 'anisphere') {
        return reply.success('非特定标签，已跳过');
      }

      log.info({ hash, tag }, 'Received download complete webhook');

      try {
        // 检查是否已处理过
        const existingResult = await tasksRepository.findByTorrentHash(hash);
        if (existingResult.isOk() && existingResult.value.length > 0) {
          log.info({ hash }, 'Torrent already processed');
          return reply.success('种子已存在');
        }

        // 获取种子信息
        const infoResult = await qbit.getTorrentInfo(hash);
        if (infoResult.isErr() || !infoResult.value) {
          log.error({ hash }, 'Failed to get torrent info');
          return reply.internalServerError('获取种子信息失败');
        }
        const torrentInfo = infoResult.value;

        // 获取文件列表
        const filesResult = await qbit.getTorrentFiles(hash);
        if (filesResult.isErr()) {
          log.error({ hash }, 'Failed to get torrent files');
          return reply.internalServerError('获取文件列表失败');
        }
        const files = filesResult.value;

        // 过滤视频文件
        const videoFiles = files.filter(f => isVideoFile(f.name));

        if (videoFiles.length === 0) {
          log.warn({ hash }, 'No video files in torrent');
          return reply.success('无视频文件');
        }

        // 创建任务记录
        const taskParams = videoFiles.map(f => ({
          torrentHash: hash,
          fileIndex: f.index,
          filename: f.name.split('/').pop() || f.name,
          filePath: `${torrentInfo.save_path}/${f.name}`,
          fileSize: f.size,
          needsTranscode: needsTranscode(f.name)
        }));

        const createResult = await tasksRepository.createMany(taskParams);
        if (createResult.isErr()) {
          log.error({ error: createResult.error }, 'Failed to create tasks');
          return reply.internalServerError('创建任务失败');
        }

        return reply.success('创建任务成功');
      } catch (error) {
        log.error({ error, hash }, 'Webhook processing failed');
        return reply.internalServerError('创建任务失败');
      }
    }
  );
}
