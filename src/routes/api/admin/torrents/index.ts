import type { FastifyInstance } from 'fastify';
import { SuccessResponseSchema } from '../../../../schemas/common.js';
import {
  type AddTorrentBody,
  AddTorrentSchema,
  type TorrentListQuery,
  TorrentListSchema,
  TorrentListSchemaResponse
} from '../../../../schemas/torrents.js';

export default async function (fastify: FastifyInstance) {
  const { authenticate, rbac, qbit, log } = fastify;

  /** 添加种子 */
  fastify.post<{ Body: AddTorrentBody }>(
    '/',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        body: AddTorrentSchema,
        response: {
          200: SuccessResponseSchema()
        }
      }
    },
    async (request, reply) => {
      const { torrentUrl } = request.body;

      try {
        // 添加种子到 qBittorrent
        const addResult = await qbit.addTorrent(torrentUrl);
        if (addResult.isErr()) {
          log.error({ error: addResult.error }, 'Failed to add torrent');
          return reply.badRequest(addResult.error.message);
        }

        if (addResult.value !== 'Ok.') {
          return reply.badRequest('添加种子失败，请检查种子链接是否有效');
        }

        return reply.success('添加种子成功');
      } catch (error) {
        log.error({ error }, 'Failed to add torrent');
        return reply.internalServerError('添加种子失败');
      }
    }
  );

  /** 资源列表 */
  fastify.get<{ Querystring: TorrentListQuery }>(
    '/',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        querystring: TorrentListSchema,
        response: {
          200: SuccessResponseSchema(TorrentListSchemaResponse)
        }
      }
    },
    async (request, reply) => {
      const { page, pageSize, status, sort, order } = request.query;

      const result = await qbit.getTorrents({
        sort,
        filter: status,
        reverse: order === 'desc',
        limit: pageSize,
        offset: (page - 1) * pageSize
      });

      if (result.isErr()) {
        return reply.internalServerError('获取种子列表失败');
      }

      const { items = [], total } = result.value;

      const res = items.map(item => {
        const { name, state, progress, size, added_on } = item;
        return {
          name,
          status: state,
          progress,
          size,
          createdAt: new Date(added_on * 1000)
        };
      });

      return reply.success('获取种子列表成功', {
        items: res,
        total
      });
    }
  );
}
