import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { animeTable, animeToTagsTable } from '../../../db/index.js';
import { toResult } from '../../../utils/result.js';
import { and, eq, inArray, like, sql } from 'drizzle-orm';
import {
  AddAnimeBody,
  AnimeListQuery,
  UpdateAnimeBody
} from '../../../schemas/anime.js';
import { escapeLike } from '../../../utils/like.js';
import { calcOffset, buildOrderBy } from '../../../utils/paginated-query.js';
import { t2s } from '../../../utils/t2s.js';

declare module 'fastify' {
  interface FastifyInstance {
    animeRepository: ReturnType<typeof createAnimeRepository>;
  }
}

const createAnimeRepository = (fastify: FastifyInstance) => {
  const db = fastify.db;

  return {
    /** 根据 ID 查找 */
    async findById(id: number) {
      return toResult(
        db
          .select()
          .from(animeTable)
          .where(eq(animeTable.id, id))
          .limit(1)
          .then(anime => anime[0])
      );
    },

    /** 根据名称查找 */
    async findByName(name: string) {
      return toResult(
        db
          .select()
          .from(animeTable)
          .where(eq(animeTable.name, name))
          .limit(1)
          .then(anime => anime[0])
      );
    },

    /** 根据名称模糊查找（用于预检匹配） */
    async findByNameLike(name: string) {
      return toResult(
        db
          .select()
          .from(animeTable)
          .where(like(animeTable.name, `%${escapeLike(name)}%`))
          .limit(5)
      );
    },

    /** 根据系列和季查找 */
    async findBySeriesAndSeason(seriesId: number, season: number) {
      return toResult(
        db
          .select()
          .from(animeTable)
          .where(
            and(
              eq(animeTable.seriesId, seriesId),
              eq(animeTable.season, season)
            )
          )
          .limit(1)
          .then(anime => anime[0])
      );
    },

    /** 创建番剧 */
    async create(anime: AddAnimeBody) {
      const { tags, ...animeData } = anime;
      return toResult(
        db.transaction(async tx => {
          const [anime] = await tx
            .insert(animeTable)
            .values(animeData)
            .returning();

          await tx
            .insert(animeToTagsTable)
            .values(tags.map(tagId => ({ animeId: anime.id, tagId })));
          return anime;
        })
      );
    },

    /** 更新番剧 */
    async update(id: number, anime: UpdateAnimeBody) {
      const { tags, ...animeData } = anime;
      return toResult(
        db.transaction(async tx => {
          if (Object.keys(animeData).length > 0) {
            await tx
              .update(animeTable)
              .set(animeData)
              .where(eq(animeTable.id, id));
          }

          if (tags) {
            await tx
              .delete(animeToTagsTable)
              .where(eq(animeToTagsTable.animeId, id));
            await tx
              .insert(animeToTagsTable)
              .values(tags.map(tagId => ({ animeId: id, tagId })));
          }
        })
      );
    },

    /** 查询列表 */
    async findAll(params: AnimeListQuery) {
      return toResult(
        (async () => {
          const {
            page,
            pageSize,
            keyword,
            sort,
            order,
            tags,
            status,
            types,
            months,
            years
          } = params;

          // 构建查询条件
          const conditions = [];

          if (keyword) {
            conditions.push(
              like(animeTable.name, `%${escapeLike(t2s(keyword))}%`)
            );
          }
          if (status?.length) {
            conditions.push(inArray(animeTable.status, status));
          }
          if (types?.length) {
            conditions.push(inArray(animeTable.type, types));
          }
          if (years?.length) {
            conditions.push(inArray(animeTable.year, years));
          }
          if (months?.length) {
            conditions.push(inArray(animeTable.month, months));
          }
          if (tags?.length) {
            conditions.push(
              inArray(
                animeTable.id,
                db
                  .select({ animeId: animeToTagsTable.animeId })
                  .from(animeToTagsTable)
                  .where(inArray(animeToTagsTable.tagId, tags))
                  .groupBy(animeToTagsTable.animeId)
                  .having(
                    sql`count(distinct ${animeToTagsTable.tagId}) = ${tags.length}`
                  )
              )
            );
          }

          const whereClause =
            conditions.length > 0 ? and(...conditions) : undefined;

          const [items, countResult] = await Promise.all([
            db.query.animeTable.findMany({
              where: whereClause,
              orderBy: buildOrderBy(animeTable[sort], order, animeTable.id),
              limit: pageSize,
              offset: calcOffset(page, pageSize),
              with: {
                tags: {
                  columns: {},
                  with: {
                    tag: { columns: { id: true, name: true } }
                  }
                }
              }
            }),
            db
              .select({ count: sql<number>`count(*)` })
              .from(animeTable)
              .where(whereClause)
          ]);

          return {
            items: items.map(item => ({
              ...item,
              tags: item.tags.map(t => t.tag)
            })),
            total: Number(countResult[0]?.count ?? 0)
          };
        })()
      );
    },

    /** 查询番剧选项 */
    async findAllOptions() {
      return toResult(
        db
          .select({
            label: sql<string>`${animeTable.name} || CASE WHEN ${animeTable.seasonName} IS NOT NULL THEN ' ' || ${animeTable.seasonName} WHEN ${animeTable.season} != 1 THEN ' 第' || ${animeTable.season} || '季' ELSE '' END`,
            value: sql<string>`${animeTable.id}::text`
          })
          .from(animeTable)
      );
    }
  };
};

export default fp(
  async (fastify: FastifyInstance) => {
    const repo = createAnimeRepository(fastify);
    fastify.decorate('animeRepository', repo);
  },
  {
    name: 'anime-repository',
    dependencies: ['db']
  }
);
