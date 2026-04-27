import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { feedbackTable } from '../../../db/index.js';
import { toResult } from '../../../utils/result.js';
import { and, eq, inArray, like, sql } from 'drizzle-orm';
import type {
  FeedbackListQuery,
  UpdateFeedbackBody
} from '../../../schemas/feedback.js';
import { calcOffset, buildOrderBy } from '../../../utils/paginated-query.js';
import { escapeLike } from '../../../utils/like.js';

declare module 'fastify' {
  interface FastifyInstance {
    feedbackRepository: ReturnType<typeof createFeedbackRepository>;
  }
}

const createFeedbackRepository = (fastify: FastifyInstance) => {
  const db = fastify.db;

  return {
    /** 查询反馈列表 */
    async findAll(params: FeedbackListQuery) {
      return toResult(
        (async () => {
          const { page, pageSize, sort, order, keyword, type, status } = params;

          const conditions = [];

          if (keyword) {
            conditions.push(
              like(feedbackTable.content, `%${escapeLike(keyword)}%`)
            );
          }

          if (type && type.length > 0) {
            conditions.push(inArray(feedbackTable.type, type));
          }

          if (status && status.length > 0) {
            conditions.push(inArray(feedbackTable.status, status));
          }

          const whereClause =
            conditions.length > 0 ? and(...conditions) : undefined;

          const [items, countResult] = await Promise.all([
            db.query.feedbackTable.findMany({
              where: whereClause,
              orderBy: buildOrderBy(feedbackTable[sort], order),
              limit: pageSize,
              offset: calcOffset(page, pageSize),
              columns: {
                id: true,
                userId: true,
                animeId: true,
                type: true,
                content: true,
                status: true,
                createdAt: true
              },
              with: {
                anime: {
                  columns: {
                    name: true,
                    cover: true,
                    season: true,
                    seasonName: true
                  }
                },
                user: {
                  columns: {
                    name: true
                  }
                }
              }
            }),
            db
              .select({ count: sql<number>`count(*)` })
              .from(feedbackTable)
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

    /** 根据ID查询反馈 */
    async findById(id: number) {
      return toResult(
        db
          .select()
          .from(feedbackTable)
          .where(eq(feedbackTable.id, id))
          .limit(1)
          .then(rows => rows[0] ?? null)
      );
    },

    /** 更新反馈 */
    async update(id: number, data: UpdateFeedbackBody) {
      return toResult(
        db
          .update(feedbackTable)
          .set(data)
          .where(eq(feedbackTable.id, id))
          .returning()
          .then(rows => rows[0] ?? null)
      );
    },

    /** 删除反馈 */
    async deleteById(id: number) {
      return toResult(
        db
          .delete(feedbackTable)
          .where(eq(feedbackTable.id, id))
          .returning()
          .then(rows => rows[0])
      );
    }
  };
};

export default fp(
  async (fastify: FastifyInstance) => {
    const repo = createFeedbackRepository(fastify);
    fastify.decorate('feedbackRepository', repo);
  },
  {
    name: 'feedback-repository',
    dependencies: ['db']
  }
);
