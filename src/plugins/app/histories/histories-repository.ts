import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { historiesTable, usersTable } from '../../../db/index.js';
import { toResult } from '../../../utils/result.js';
import { eq, sql, and, inArray, like } from 'drizzle-orm';
import type { HistoryListQuery } from '../../../schemas/histories.js';
import { calcOffset, buildOrderBy } from '../../../utils/paginated-query.js';
import { escapeLike } from '../../../utils/like.js';
import { t2s } from '../../../utils/t2s.js';

declare module 'fastify' {
  interface FastifyInstance {
    historiesRepository: ReturnType<typeof createHistoriesRepository>;
  }
}

const createHistoriesRepository = (fastify: FastifyInstance) => {
  const db = fastify.db;

  return {
    /** 查询观看记录列表 */
    async findAll(params: HistoryListQuery) {
      return toResult(
        (async () => {
          const { page, pageSize, sort, order, keyword } = params;

          const whereClause = keyword
            ? inArray(
                historiesTable.userId,
                db
                  .select({ id: usersTable.id })
                  .from(usersTable)
                  .where(like(usersTable.name, `%${escapeLike(t2s(keyword))}%`))
              )
            : undefined;

          const [items, countResult] = await Promise.all([
            db.query.historiesTable.findMany({
              where: whereClause,
              orderBy: buildOrderBy(
                historiesTable[sort],
                order,
                historiesTable.id
              ),
              limit: pageSize,
              offset: calcOffset(page, pageSize),
              with: {
                user: {
                  columns: {
                    name: true
                  }
                },
                video: {
                  columns: {
                    episode: true
                  },
                  with: {
                    anime: {
                      columns: {
                        name: true,
                        season: true,
                        seasonName: true,
                        cover: true
                      }
                    }
                  }
                }
              }
            }),
            db
              .select({ count: sql<number>`count(*)` })
              .from(historiesTable)
              .where(whereClause)
          ]);

          return {
            items: items.map(item => ({
              id: item.id,
              user: item.user,
              anime: {
                name: `${item.video.anime.name}${item.video.anime.seasonName ? ` ${item.video.anime.seasonName}` : item.video.anime.season !== 1 ? ` 第${item.video.anime.season}季` : ''} ${`(第${item.video.episode}集)`}`,
                cover: item.video.anime.cover
              },
              time: item.time,
              createdAt: item.createdAt
            })),
            total: Number(countResult[0]?.count ?? 0)
          };
        })()
      );
    },

    /** 根据 ID 查找观看记录 */
    async findById(id: number) {
      return toResult(
        db
          .select()
          .from(historiesTable)
          .where(eq(historiesTable.id, id))
          .limit(1)
          .then(rows => rows[0] ?? null)
      );
    },

    /** 根据 userId 和 videoId 查找观看记录 */
    async findByUserIdAndVideoId(userId: number, videoId: number) {
      return toResult(
        db
          .select()
          .from(historiesTable)
          .where(
            and(
              eq(historiesTable.userId, userId),
              eq(historiesTable.videoId, videoId)
            )
          )
          .limit(1)
          .then(rows => rows[0] ?? null)
      );
    },

    /** 删除观看记录 */
    async deleteById(id: number) {
      return toResult(
        db
          .delete(historiesTable)
          .where(eq(historiesTable.id, id))
          .returning()
          .then(rows => rows[0])
      );
    }
  };
};

export default fp(
  async (fastify: FastifyInstance) => {
    const repo = createHistoriesRepository(fastify);
    fastify.decorate('historiesRepository', repo);
  },
  {
    name: 'histories-repository',
    dependencies: ['db']
  }
);
