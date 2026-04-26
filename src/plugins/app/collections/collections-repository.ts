import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { collectionsTable, usersTable } from '../../../db/index.js';
import { toResult } from '../../../utils/result.js';
import { eq, inArray, like, sql } from 'drizzle-orm';
import type { CollectionListQuery } from '../../../schemas/collections.js';
import { calcOffset, buildOrderBy } from '../../../utils/paginated-query.js';
import { escapeLike } from '../../../utils/like.js';

declare module 'fastify' {
  interface FastifyInstance {
    collectionsRepository: ReturnType<typeof createCollectionsRepository>;
  }
}

const createCollectionsRepository = (fastify: FastifyInstance) => {
  const db = fastify.db;

  return {
    /** 查询追番列表 */
    async findAll(params: CollectionListQuery) {
      return toResult(
        (async () => {
          const { page, pageSize, sort, order, keyword } = params;

          const whereClause = keyword
            ? inArray(
                collectionsTable.userId,
                db
                  .select({ id: usersTable.id })
                  .from(usersTable)
                  .where(like(usersTable.name, `%${escapeLike(keyword)}%`))
              )
            : undefined;

          const [items, countResult] = await Promise.all([
            db.query.collectionsTable.findMany({
              where: whereClause,
              orderBy: buildOrderBy(collectionsTable[sort], order),
              limit: pageSize,
              offset: calcOffset(page, pageSize),
              with: {
                user: {
                  columns: {
                    name: true
                  }
                },
                anime: {
                  columns: {
                    name: true,
                    cover: true
                  }
                }
              }
            }),
            db
              .select({ count: sql<number>`count(*)` })
              .from(collectionsTable)
              .where(whereClause)
          ]);

          return {
            items,
            total: Number(countResult[0]?.count ?? 0)
          };
        })()
      );
    },

    /** 删除追番 */
    async deleteById(id: number) {
      return toResult(
        db
          .delete(collectionsTable)
          .where(eq(collectionsTable.id, id))
          .returning()
          .then(rows => rows[0])
      );
    }
  };
};

export default fp(
  async (fastify: FastifyInstance) => {
    const repo = createCollectionsRepository(fastify);
    fastify.decorate('collectionsRepository', repo);
  },
  {
    name: 'collections-repository',
    dependencies: ['db']
  }
);
