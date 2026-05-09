import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { scoresTable, usersTable } from '../../../db/index.js';
import { toResult } from '../../../utils/result.js';
import { and, eq, inArray, like, sql } from 'drizzle-orm';
import type { ScoreListQuery } from '../../../schemas/scores.js';
import { calcOffset, buildOrderBy } from '../../../utils/paginated-query.js';
import { escapeLike } from '../../../utils/like.js';
import { t2s } from '../../../utils/t2s.js';

declare module 'fastify' {
  interface FastifyInstance {
    scoresRepository: ReturnType<typeof createScoresRepository>;
  }
}

const createScoresRepository = (fastify: FastifyInstance) => {
  const db = fastify.db;

  return {
    /** 查询评分列表 */
    async findAll(params: ScoreListQuery) {
      return toResult(
        (async () => {
          const { page, pageSize, sort, order, keyword, status } = params;

          const conditions = [];

          if (keyword) {
            conditions.push(
              inArray(
                scoresTable.userId,
                db
                  .select({ id: usersTable.id })
                  .from(usersTable)
                  .where(like(usersTable.name, `%${escapeLike(t2s(keyword))}%`))
              )
            );
          }

          if (status && status.length > 0) {
            conditions.push(inArray(scoresTable.status, status));
          }

          const whereClause =
            conditions.length > 0 ? and(...conditions) : undefined;

          const [items, countResult] = await Promise.all([
            db.query.scoresTable.findMany({
              where: whereClause,
              orderBy: buildOrderBy(scoresTable[sort], order, scoresTable.id),
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
              .from(scoresTable)
              .where(whereClause)
          ]);

          return {
            items,
            total: Number(countResult[0]?.count ?? 0)
          };
        })()
      );
    },

    /** 根据ID查询评分 */
    async findById(id: number) {
      return toResult(
        db
          .select()
          .from(scoresTable)
          .where(eq(scoresTable.id, id))
          .limit(1)
          .then(rows => rows[0] ?? null)
      );
    },

    /** 更新评分 */
    async update(id: number, data: Record<string, unknown>) {
      return toResult(
        db
          .update(scoresTable)
          .set(data)
          .where(eq(scoresTable.id, id))
          .returning()
          .then(rows => rows[0])
      );
    },

    /** 删除评分 */
    async deleteById(id: number) {
      return toResult(
        db
          .delete(scoresTable)
          .where(eq(scoresTable.id, id))
          .returning()
          .then(rows => rows[0])
      );
    }
  };
};

export default fp(
  async (fastify: FastifyInstance) => {
    const repo = createScoresRepository(fastify);
    fastify.decorate('scoresRepository', repo);
  },
  {
    name: 'scores-repository',
    dependencies: ['db']
  }
);
