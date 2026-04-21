import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { tagsTable } from '../../../db/index.js';
import { toResult } from '../../../utils/result.js';
import { eq, inArray, like, sql } from 'drizzle-orm';
import { TagsListQuery } from '../../../schemas/tags.js';
import { escapeLike } from '../../../utils/like.js';
import { calcOffset, buildOrderBy } from '../../../utils/paginated-query.js';

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

    /** 根据 IDs 查找 */
    async findByIds(ids: number[]) {
      return toResult(
        db
          .select()
          .from(tagsTable)
          .where(inArray(tagsTable.id, ids))
          .then(tags => tags)
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

          const whereClause = keyword
            ? like(tagsTable.name, `%${escapeLike(keyword)}%`)
            : undefined;

          const items = await db.query.tagsTable.findMany({
            where: whereClause,
            orderBy: buildOrderBy(tagsTable[sort], order),
            limit: pageSize,
            offset: calcOffset(page, pageSize)
          });

          const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(tagsTable)
            .where(whereClause);

          return { items, total: Number(countResult[0]?.count ?? 0) };
        })()
      );
    },

    /** 查询选项 */
    async findAllOptions() {
      return toResult(
        db
          .select({
            label: tagsTable.name,
            value: sql<string>`${tagsTable.id}::text`
          })
          .from(tagsTable)
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
