import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { topicsTable, animeToTopicsTable } from '../../../db/index.js';
import { toResult } from '../../../utils/result.js';
import { and, eq, inArray, like, sql } from 'drizzle-orm';
import type {
  TopicListQuery,
  AddTopicBody,
  UpdateTopicBody
} from '../../../schemas/topics.js';
import { calcOffset, buildOrderBy } from '../../../utils/paginated-query.js';
import { escapeLike } from '../../../utils/like.js';

declare module 'fastify' {
  interface FastifyInstance {
    topicsRepository: ReturnType<typeof createTopicsRepository>;
  }
}

const createTopicsRepository = (fastify: FastifyInstance) => {
  const db = fastify.db;

  return {
    /** 查询专题列表 */
    async findAll(params: TopicListQuery) {
      return toResult(
        (async () => {
          const { page, pageSize, sort, order, keyword, status } = params;

          const conditions = [];

          if (keyword) {
            conditions.push(like(topicsTable.name, `%${escapeLike(keyword)}%`));
          }

          if (status && status.length > 0) {
            conditions.push(inArray(topicsTable.status, status));
          }

          const whereClause =
            conditions.length > 0 ? and(...conditions) : undefined;

          const [items, countResult] = await Promise.all([
            db.query.topicsTable.findMany({
              where: whereClause,
              orderBy: buildOrderBy(topicsTable[sort], order),
              limit: pageSize,
              offset: calcOffset(page, pageSize),
              columns: {
                id: true,
                name: true,
                description: true,
                status: true,
                cover: true,
                createdAt: true
              },
              with: {
                animeToTopics: {
                  columns: {},
                  with: {
                    anime: {
                      columns: {
                        id: true,
                        name: true,
                        season: true,
                        seasonName: true
                      }
                    }
                  }
                }
              }
            }),
            db
              .select({ count: sql<number>`count(*)` })
              .from(topicsTable)
              .where(whereClause)
          ]);

          return {
            items: items.map(item => ({
              ...item,
              anime: item.animeToTopics.map(t => ({
                id: t.anime.id,
                name: `${t.anime.name}${t.anime.seasonName ? ` ${t.anime.seasonName}` : t.anime.season !== 1 ? ` 第${t.anime.season}季` : ''}`
              }))
            })),
            total: Number(countResult[0]?.count ?? 0)
          };
        })()
      );
    },

    /** 根据ID查询专题 */
    async findById(id: number) {
      return toResult(
        db
          .select()
          .from(topicsTable)
          .where(eq(topicsTable.id, id))
          .limit(1)
          .then(rows => rows[0] ?? null)
      );
    },

    /** 根据名称查询专题 */
    async findByName(name: string) {
      return toResult(
        db
          .select()
          .from(topicsTable)
          .where(eq(topicsTable.name, name))
          .limit(1)
          .then(rows => rows[0] ?? null)
      );
    },

    /** 创建专题 */
    async create(data: AddTopicBody) {
      const { animeIds, ...topicData } = data;
      return toResult(
        db.transaction(async tx => {
          const [topic] = await tx
            .insert(topicsTable)
            .values(topicData)
            .returning();

          if (animeIds && animeIds.length > 0) {
            await tx
              .insert(animeToTopicsTable)
              .values(
                animeIds.map(animeId => ({ animeId, topicId: topic.id }))
              );
          }

          return topic;
        })
      );
    },

    /** 更新专题 */
    async update(id: number, data: UpdateTopicBody) {
      const { animeIds, ...topicData } = data;
      return toResult(
        db.transaction(async tx => {
          if (Object.keys(topicData).length > 0) {
            await tx
              .update(topicsTable)
              .set(topicData)
              .where(eq(topicsTable.id, id));
          }

          if (animeIds !== undefined) {
            await tx
              .delete(animeToTopicsTable)
              .where(eq(animeToTopicsTable.topicId, id));

            if (animeIds.length > 0) {
              await tx
                .insert(animeToTopicsTable)
                .values(animeIds.map(animeId => ({ animeId, topicId: id })));
            }
          }
        })
      );
    },

    /** 删除专题 */
    async deleteById(id: number) {
      return toResult(
        db
          .delete(topicsTable)
          .where(eq(topicsTable.id, id))
          .returning()
          .then(rows => rows[0])
      );
    }
  };
};

export default fp(
  async (fastify: FastifyInstance) => {
    const repo = createTopicsRepository(fastify);
    fastify.decorate('topicsRepository', repo);
  },
  {
    name: 'topics-repository',
    dependencies: ['db']
  }
);
