import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { tasksTable } from '../../../db/index.js';
import { toResult } from '../../../utils/result.js';
import { eq } from 'drizzle-orm';

declare module 'fastify' {
  interface FastifyInstance {
    tasksRepository: ReturnType<typeof createTasksRepository>;
  }
}

const createTasksRepository = (fastify: FastifyInstance) => {
  const db = fastify.db;

  return {
    /** 根据 ID 查找任务 */
    async findById(id: number) {
      return toResult(
        db
          .select()
          .from(tasksTable)
          .where(eq(tasksTable.id, id))
          .limit(1)
          .then(tasks => tasks[0])
      );
    },

    /** 创建任务 */
    async create(torrentUrl: string) {
      return toResult(
        db
          .insert(tasksTable)
          .values({ torrentUrl })
          .returning()
          .then(tasks => tasks[0])
      );
    },

    /** 检查是否已存在重复任务 */
    async existsByTorrentUrl(torrentUrl: string) {
      return toResult(
        db
          .select({ id: tasksTable.id })
          .from(tasksTable)
          .where(eq(tasksTable.torrentUrl, torrentUrl))
          .limit(1)
          .then(tasks => tasks[0])
      );
    },

    /** 开始下载 */
    async startDownload(id: number, hash: string) {
      return toResult(
        db
          .update(tasksTable)
          .set({ status: 'downloading', torrentHash: hash })
          .where(eq(tasksTable.id, id))
          .returning()
          .then(tasks => tasks[0])
      );
    },

    /** 标记任务失败 */
    async markFailed(id: number, errorMessage: string, failedAtStatus: string) {
      return toResult(
        db
          .update(tasksTable)
          .set({
            status: 'failed',
            errorMessage,
            failedAtStatus
          })
          .where(eq(tasksTable.id, id))
          .returning()
          .then(tasks => tasks[0])
      );
    }
  };
};

export default fp(
  async (fastify: FastifyInstance) => {
    const repo = createTasksRepository(fastify);
    fastify.decorate('tasksRepository', repo);
  },
  {
    name: 'tasks-repository',
    dependencies: ['db']
  }
);
