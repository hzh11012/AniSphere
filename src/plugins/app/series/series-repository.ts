import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { seriesTable } from '../../../db/index.js';
import { toResult } from '../../../utils/result.js';
import { eq, like, sql } from 'drizzle-orm';
import {
  SeriesListQuery,
  SeriesOptionQuery,
  AddSeriesBody
} from '../../../schemas/series.js';
import { escapeLike } from '../../../utils/like.js';
import { calcOffset, buildOrderBy } from '../../../utils/paginated-query.js';

declare module 'fastify' {
  interface FastifyInstance {
    seriesRepository: ReturnType<typeof createSeriesRepository>;
  }
}

const createSeriesRepository = (fastify: FastifyInstance) => {
  const db = fastify.db;

  return {
    /** 根据 ID 查找 */
    async findById(id: number) {
      return toResult(
        db
          .select()
          .from(seriesTable)
          .where(eq(seriesTable.id, id))
          .limit(1)
          .then(series => series[0])
      );
    },

    /** 根据名称查找 */
    async findByName(name: string) {
      return toResult(
        db
          .select()
          .from(seriesTable)
          .where(eq(seriesTable.name, name))
          .limit(1)
          .then(series => series[0])
      );
    },

    /** 创建系列 */
    async create(series: AddSeriesBody) {
      return toResult(
        db
          .insert(seriesTable)
          .values(series)
          .returning()
          .then(series => series[0])
      );
    },

    /** 查询列表 */
    async findAll(params: SeriesListQuery) {
      return toResult(
        (async () => {
          const { page, pageSize, keyword, sort, order } = params;

          const whereClause = keyword
            ? like(seriesTable.name, `%${escapeLike(keyword)}%`)
            : undefined;

          const [items, countResult] = await Promise.all([
            db.query.seriesTable.findMany({
              where: whereClause,
              orderBy: buildOrderBy(seriesTable[sort], order),
              limit: pageSize,
              offset: calcOffset(page, pageSize),
              with: {
                anime: {
                  columns: {
                    name: true,
                    season: true
                  }
                }
              }
            }),
            db
              .select({ count: sql<number>`count(*)` })
              .from(seriesTable)
              .where(whereClause)
          ]);

          return { items, total: Number(countResult[0]?.count ?? 0) };
        })()
      );
    },

    /** 删除系列 */
    async deleteById(id: number) {
      return toResult(
        db
          .delete(seriesTable)
          .where(eq(seriesTable.id, id))
          .returning()
          .then(series => series[0])
      );
    },

    /** 查询选项 */
    async findAllOptions(params: SeriesOptionQuery) {
      return toResult(
        (async () => {
          const { keyword } = params;

          const whereClause = keyword
            ? like(seriesTable.name, `%${escapeLike(keyword)}%`)
            : undefined;

          return db
            .select({
              label: seriesTable.name,
              value: sql<string>`${seriesTable.id}::text`
            })
            .from(seriesTable)
            .where(whereClause);
        })()
      );
    }
  };
};

export default fp(
  async (fastify: FastifyInstance) => {
    const repo = createSeriesRepository(fastify);
    fastify.decorate('seriesRepository', repo);
  },
  {
    name: 'series-repository',
    dependencies: ['db']
  }
);
