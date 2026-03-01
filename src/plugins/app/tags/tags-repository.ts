import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { tagsTable } from '../../../db/index.js';
import { toResult } from '../../../utils/result.js';
import { and, asc, desc, eq, like, sql } from 'drizzle-orm';
import { TagsListQuery } from '../../../schemas/tags.js';

declare module 'fastify' {
  interface FastifyInstance {
    tagsRepository: ReturnType<typeof createTagsRepository>;
  }
}

const createTagsRepository = (fastify: FastifyInstance) => {
  const db = fastify.db;

  return {
    /** 根据 ID 查找 */
    async findById(id: number) {
      return toResult(
        db
          .select()
          .from(tagsTable)
          .where(eq(tagsTable.id, id))
          .limit(1)
          .then(tags => tags[0])
      );
    },

    /** 根据名称查找 */
    async findByName(name: string) {
      return toResult(
        db
          .select()
          .from(tagsTable)
          .where(eq(tagsTable.name, name))
          .limit(1)
          .then(tags => tags[0])
      );
    },

    /** 查询列表 */
    async findAll(params: TagsListQuery) {
      return toResult(
        (async () => {
          const { page, pageSize, keyword, sort, order } = params;
          const offset = (page - 1) * pageSize;

          // 构建查询条件
          const conditions = [];

          if (keyword) {
            conditions.push(like(tagsTable.name, `%${keyword}%`));
          }

          const whereClause =
            conditions.length > 0 ? and(...conditions) : undefined;

          // 排序
          const orderByColumn = {
            createdAt: tagsTable.createdAt
          }[sort];

          const orderBy =
            order === 'asc' ? asc(orderByColumn) : desc(orderByColumn);

          // 查询数据
          const items = await db.query.tagsTable.findMany({
            where: whereClause,
            orderBy: orderBy,
            limit: pageSize,
            offset: offset
          });

          // 查询总数
          const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(tagsTable)
            .where(whereClause);

          const total = Number(countResult[0]?.count ?? 0);

          return {
            items,
            total
          };
        })()
      );
    }
  };
};

export default fp(
  async (fastify: FastifyInstance) => {
    const repo = createTagsRepository(fastify);
    fastify.decorate('tagsRepository', repo);
  },
  {
    name: 'tags-repository',
    dependencies: ['db']
  }
);
