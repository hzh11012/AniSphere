import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { videosTable } from '../../../db/index.js';
import { toResult } from '../../../utils/result.js';
import { and, eq, like, sql } from 'drizzle-orm';
import type {
  VideoListQuery,
  AddVideoBody,
  UpdateVideoBody
} from '../../../schemas/videos.js';
import { calcOffset, buildOrderBy } from '../../../utils/paginated-query.js';
import { escapeLike } from '../../../utils/like.js';
import { t2s } from '../../../utils/t2s.js';

declare module 'fastify' {
  interface FastifyInstance {
    videosRepository: ReturnType<typeof createVideosRepository>;
  }
}

const createVideosRepository = (fastify: FastifyInstance) => {
  const db = fastify.db;

  return {
    /** 查询视频列表 */
    async findAll(params: VideoListQuery) {
      return toResult(
        (async () => {
          const { page, pageSize, sort, order, keyword } = params;

          // 构建查询条件
          const conditions = [];

          if (keyword) {
            conditions.push(
              like(videosTable.title, `%${escapeLike(t2s(keyword))}%`)
            );
          }

          const whereClause =
            conditions.length > 0 ? and(...conditions) : undefined;

          const [items, countResult] = await Promise.all([
            db.query.videosTable.findMany({
              where: whereClause,
              orderBy: buildOrderBy(videosTable[sort], order, videosTable.id),
              limit: pageSize,
              offset: calcOffset(page, pageSize),
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
            }),
            db
              .select({ count: sql<number>`count(*)` })
              .from(videosTable)
              .where(whereClause)
          ]);

          return {
            items: items.map(item => ({
              ...item,
              anime: {
                name: `${item.anime.name}${item.anime.seasonName ? ` ${item.anime.seasonName}` : item.anime.season !== 1 ? ` 第${item.anime.season}季` : ''}`,
                cover: item.anime.cover
              }
            })),
            total: Number(countResult[0]?.count ?? 0)
          };
        })()
      );
    },

    /** 根据 ID 查找视频 */
    async findById(id: number) {
      return toResult(
        db
          .select()
          .from(videosTable)
          .where(eq(videosTable.id, id))
          .limit(1)
          .then(rows => rows[0] ?? null)
      );
    },

    /** 根据 animeId 和 episode 查找视频 */
    async findByAnimeIdAndEpisode(animeId: number, episode: number) {
      return toResult(
        db
          .select()
          .from(videosTable)
          .where(
            and(
              eq(videosTable.animeId, animeId),
              eq(videosTable.episode, episode)
            )
          )
          .limit(1)
          .then(rows => rows[0] ?? null)
      );
    },

    /** 创建视频 */
    async create(data: AddVideoBody) {
      return toResult(
        db
          .insert(videosTable)
          .values(data)
          .returning()
          .then(rows => rows[0])
      );
    },

    /** 更新视频 */
    async update(id: number, data: UpdateVideoBody) {
      return toResult(
        db
          .update(videosTable)
          .set(data)
          .where(eq(videosTable.id, id))
          .returning()
          .then(rows => rows[0])
      );
    },

    /** 删除视频 */
    async deleteById(id: number) {
      return toResult(
        db
          .delete(videosTable)
          .where(eq(videosTable.id, id))
          .returning()
          .then(rows => rows[0])
      );
    }
  };
};

export default fp(
  async (fastify: FastifyInstance) => {
    const repo = createVideosRepository(fastify);
    fastify.decorate('videosRepository', repo);
  },
  {
    name: 'videos-repository',
    dependencies: ['db']
  }
);
