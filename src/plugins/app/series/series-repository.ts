import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { seriesTable } from '../../../db/index.js';
import { toResult } from '../../../utils/result.js';
import { and, asc, desc, eq, like, sql } from 'drizzle-orm';
import { SeriesListQuery } from '../../../schemas/series.js';

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
    async create(series: { name: string }) {
      return toResult(
        db
          .insert(seriesTable)
          .values({ name: series.name })
          .returning()
          .then(series => series[0])
      );
    },

    /** 查询列表 */
    async findAll(params: SeriesListQuery) {
      return toResult(
        (async () => {
          const { page, pageSize, keyword, sort, order } = params;
          const offset = (page - 1) * pageSize;

          // 构建查询条件
          const conditions = [];

          if (keyword) {
            conditions.push(like(seriesTable.name, `%${keyword}%`));
          }

          const whereClause =
            conditions.length > 0 ? and(...conditions) : undefined;

          // 排序
          const orderByColumn = {
            createdAt: seriesTable.createdAt
          }[sort];

          const orderBy =
            order === 'asc' ? asc(orderByColumn) : desc(orderByColumn);

          // 查询数据
          const items = await db.query.seriesTable.findMany({
            where: whereClause,
            orderBy: orderBy,
            limit: pageSize,
            offset: offset,
            with: {
              anime: {
                columns: {
                  name: true,
                  season: true
                }
              }
            }
          });

          // 查询总数
          const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(seriesTable)
            .where(whereClause);

          const total = Number(countResult[0]?.count ?? 0);

          return {
            items,
            total
          };
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
