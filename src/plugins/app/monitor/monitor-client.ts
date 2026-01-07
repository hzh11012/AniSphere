import Cron from 'node-cron';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { tasksTable } from '../../../db/tasks/index.js';

const QBIT_COMPLETED_STATES: string[] = [
  'uploading',
  'stalledUP',
  'pausedUP',
  'queuedUP',
  'forcedUP'
];
const VIDEO_EXTENSIONS = ['.mp4'];

export class MonitorClient {
  private monitorJob: Cron.ScheduledTask | null = null;

  constructor(private readonly fastify: FastifyInstance) {}

  start(): void {
    this.monitorJob = Cron.schedule('*/10 * * * * *', () => {
      this.checkDownloadStatus().catch(err => {
        this.fastify.log.error({ err }, 'Monitor check failed');
      });
    });
    this.fastify.log.info('Monitor service started');
  }

  stop(): void {
    this.monitorJob?.stop();
    this.fastify.log.info('Monitor service stopped');
  }

  /** 检查是否下载完成 */
  private isDownloadComplete(state: string): boolean {
    return QBIT_COMPLETED_STATES.includes(state);
  }

  /** 检查是否为视频文件 */
  private isVideoFile(filePath: string): boolean {
    const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'));
    return VIDEO_EXTENSIONS.includes(ext);
  }

  private async checkDownloadStatus(): Promise<void> {
    const tasks = await this.fastify.db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.status, 'downloading'));

    if (tasks.length === 0) return;

    for (const task of tasks) {
      try {
        if (!task.torrentHash) {
          this.fastify.log.warn(
            { taskId: task.id },
            'Task has no torrent hash'
          );
          await this.fastify.db
            .update(tasksTable)
            .set({
              status: 'failed',
              errorMessage: '任务缺少种子 hash',
              failedAtStatus: 'downloading'
            })
            .where(eq(tasksTable.id, task.id));
          continue;
        }

        const infoResult = await this.fastify.qbit.getTorrentInfo(
          task.torrentHash
        );
        if (infoResult.isErr()) {
          this.fastify.log.error(
            { error: infoResult.error, taskId: task.id },
            'Failed to get torrent info'
          );
          continue;
        }

        const info = infoResult.value;
        if (!info) {
          continue;
        }

        // 跳过正在下载元数据的种子（.torrent 文件本身）
        if (info.state === 'metaDL') continue;

        // 更新进度
        const progress = Math.round(info.progress * 100);
        if (progress !== task.downloadProgress) {
          await this.fastify.db
            .update(tasksTable)
            .set({ downloadProgress: progress })
            .where(eq(tasksTable.id, task.id));
        }

        if (info.progress >= 1 && this.isDownloadComplete(info.state)) {
          const contentPath = info.content_path;
          const size = info.size;

          // 不是视频文件 → 标记失败
          if (!this.isVideoFile(contentPath)) {
            await this.fastify.db
              .update(tasksTable)
              .set({
                status: 'failed',
                errorMessage: '文件格式不支持，仅支持mp4',
                failedAtStatus: 'downloading'
              })
              .where(eq(tasksTable.id, task.id));
            continue;
          }

          // 下载完成
          await this.fastify.db
            .update(tasksTable)
            .set({
              status: 'downloaded',
              downloadPath: contentPath,
              fileSize: size,
              downloadProgress: 100
            })
            .where(eq(tasksTable.id, task.id));

          this.fastify.log.info(
            {
              taskId: task.id,
              downloadPath: contentPath,
              fileSize: size
            },
            'Download completed'
          );
        }
      } catch (error) {
        this.fastify.log.error(
          { error, taskId: task.id },
          'Failed to check torrent'
        );
      }
    }
  }
}
