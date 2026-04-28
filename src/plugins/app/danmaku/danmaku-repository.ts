import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { danmakuTable } from '../../../db/index.js';
import { toResult } from '../../../utils/result.js';
import { and, eq, like, sql } from 'drizzle-orm';
import type { DanmakuListQuery } from '../../../schemas/danmaku.js';
import { calcOffset, buildOrderBy } from '../../../utils/paginated-query.js';
import { escapeLike } from '../../../utils/like.js';

declare module 'fastify' {
  interface FastifyInstance {
    danmakuRepository: ReturnType<typeof createDanmakuRepository>;
  }
}

const createDanmakuRepository = (fastify: FastifyInstance) => {
  const db = fastify.db;

  return {
    /** 查询弹幕列表 */
    async findAll(params: DanmakuListQuery) {
      return toResult(
        (async () => {
          const { page, pageSize, sort, order, keyword, mode } = params;

          const conditions = [];

          if (keyword) {
            conditions.push(
              like(danmakuTable.text, `%${escapeLike(keyword)}%`)
            );
          }

          if (mode) {
            conditions.push(eq(danmakuTable.mode, mode));
          }

          const whereClause =
            conditions.length > 0 ? and(...conditions) : undefined;

          const [items, countResult] = await Promise.all([
            db.query.danmakuTable.findMany({
              where: whereClause,
              orderBy: buildOrderBy(danmakuTable[sort], order),
              limit: pageSize,
              offset: calcOffset(page, pageSize),
              columns: {
                id: true,
                text: true,
                mode: true,
                color: true,
                time: true,
                createdAt: true
              },
              with: {
                user: {
                  columns: { name: true }
                },
                video: {
                  columns: { episode: true },
                  with: {
                    anime: {
                      columns: { name: true, season: true, seasonName: true }
                    }
                  }
                }
              }
            }),
            db
              .select({ count: sql<number>`count(*)` })
              .from(danmakuTable)
              .where(whereClause)
          ]);

          return {
            items: items.map(item => ({
              ...item,
              anime: {
                name: `${item.video.anime.name}${item.video.anime.seasonName ? ` ${item.video.anime.seasonName}` : item.video.anime.season !== 1 ? ` 第${item.video.anime.season}季` : ''} ${`(第${item.video.episode}集)`}`
              }
            })),
            total: Number(countResult[0]?.count ?? 0)
          };
        })()
      );
    },

    /** 根据ID查询弹幕 */
    async findById(id: number) {
      return toResult(
        db
          .select()
          .from(danmakuTable)
          .where(eq(danmakuTable.id, id))
          .limit(1)
          .then(rows => rows[0] ?? null)
      );
    },

    /** 删除弹幕 */
    async deleteById(id: number) {
      return toResult(
        db
          .delete(danmakuTable)
          .where(eq(danmakuTable.id, id))
          .returning()
          .then(rows => rows[0])
      );
    }
  };
};

export default fp(
  async (fastify: FastifyInstance) => {
    const repo = createDanmakuRepository(fastify);
    fastify.decorate('danmakuRepository', repo);
  },
  {
    name: 'danmaku-repository',
    dependencies: ['db']
  }
);
