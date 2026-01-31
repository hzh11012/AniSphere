import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { tasksTable } from '../../../db/index.js';
import { toResult } from '../../../utils/result.js';
import { and, asc, desc, eq, inArray, like, sql } from 'drizzle-orm';
import { TaskListQuery } from '../../../schemas/webhook.js';

declare module 'fastify' {
  interface FastifyInstance {
    tasksRepository: ReturnType<typeof createTasksRepository>;
  }
}

interface CreateTaskParams {
  torrentHash: string;
  fileIndex: number;
  filename: string;
  filePath: string;
  fileSize: number;
  needsTranscode: boolean;
}

const createTasksRepository = (fastify: FastifyInstance) => {
  const db = fastify.db;

  return {
    /** 根据 ID 查找 */
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

    /** 获取所有文件 */
    async findAll(params: TaskListQuery) {
      return toResult(
        (async () => {
          const { page, pageSize, keyword, status, sort, order } = params;
          const offset = (page - 1) * pageSize;

          // 构建查询条件
          const conditions = [];

          if (keyword) {
            conditions.push(like(tasksTable.filename, `%${keyword}%`));
          }

          if (status) {
            if (Array.isArray(status)) {
              conditions.push(inArray(tasksTable.status, status as any));
            } else {
              conditions.push(eq(tasksTable.status, status as any));
            }
          }

          const whereClause =
            conditions.length > 0 ? and(...conditions) : undefined;

          // 排序
          const orderByColumn = {
            createdAt: tasksTable.createdAt,
            fileSize: tasksTable.fileSize
          }[sort];

          const orderBy =
            order === 'asc' ? asc(orderByColumn) : desc(orderByColumn);

          // 查询数据
          const items = await db
            .select()
            .from(tasksTable)
            .where(whereClause)
            .orderBy(orderBy)
            .limit(pageSize)
            .offset(offset);

          // 查询总数
          const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(tasksTable)
            .where(whereClause);

          const total = Number(countResult[0]?.count ?? 0);

          return {
            items,
            total
          };
        })()
      );
    },

    /** 根据种子 hash 获取所有文件 */
    async findByTorrentHash(torrentHash: string) {
      return toResult(
        db
          .select()
          .from(tasksTable)
          .where(eq(tasksTable.torrentHash, torrentHash))
      );
    },

    /** 批量创建 */
    async createMany(files: CreateTaskParams[]) {
      if (files.length === 0) {
        return toResult(Promise.resolve([]));
      }
      return toResult(db.insert(tasksTable).values(files).returning());
    },

    /** 标记开始转码 */
    async markTranscoding(id: number) {
      return toResult(
        db
          .update(tasksTable)
          .set({ status: 'transcoding' })
          .where(eq(tasksTable.id, id))
          .returning()
          .then(files => files[0])
      );
    },

    /** 更新转码进度 */
    async updateTranscodeProgress(id: number, progress: number) {
      return toResult(
        db
          .update(tasksTable)
          .set({ transcodeProgress: progress })
          .where(eq(tasksTable.id, id))
          .returning()
          .then(files => files[0])
      );
    },

    /** 标记转码完成 */
    async markTranscoded(id: number, outputPath: string) {
      return toResult(
        db
          .update(tasksTable)
          .set({
            status: 'transcoded',
            transcodeProgress: 100,
            transcodeOutputPath: outputPath
          })
          .where(eq(tasksTable.id, id))
          .returning()
          .then(files => files[0])
      );
    },

    /** 标记已成功 */
    async markCompleted(id: number) {
      return toResult(
        db
          .update(tasksTable)
          .set({ status: 'completed' })
          .where(eq(tasksTable.id, id))
          .returning()
          .then(files => files[0])
      );
    },

    /** 标记失败 */
    async markFailed(id: number, errorMessage: string) {
      return toResult(
        db
          .update(tasksTable)
          .set({ status: 'failed', errorMessage })
          .where(eq(tasksTable.id, id))
          .returning()
          .then(files => files[0])
      );
    },

    /** 删除单个记录 */
    async deleteById(id: number) {
      return toResult(
        db
          .delete(tasksTable)
          .where(eq(tasksTable.id, id))
          .returning()
          .then(files => files[0])
      );
    },

    /** 重置任务状态 */
    async resetById(id: number) {
      return toResult(
        db
          .update(tasksTable)
          .set({
            status: 'transcoding',
            errorMessage: null,
            transcodeProgress: 0,
            transcodeOutputPath: null
          })
          .where(eq(tasksTable.id, id))
          .returning()
          .then(files => files[0])
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
