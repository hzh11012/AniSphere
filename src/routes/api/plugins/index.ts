import type { FastifyInstance } from 'fastify';
import {
  ListResponseSchema,
  MessageResponseSchema
} from '../../../schemas/common.js';
import {
  PluginsQueryStringSchema,
  PluginSchema,
  PluginConfigSchema
} from '../../../schemas/plugins.js';
import { Static } from '@sinclair/typebox';

type PluginsQueryString = Static<typeof PluginsQueryStringSchema>;
type PluginParams = Static<typeof PluginSchema>;
type PluginConfigBody = Static<typeof PluginConfigSchema>;

export default async function (fastify: FastifyInstance) {
  const { authenticate, rbac, pluginService } = fastify;

  // 获取所有插件
  fastify.get<{
    Querystring: PluginsQueryString;
  }>(
    '/',
    {
      preHandler: [authenticate, rbac.requireRole('admin')],
      schema: {
        querystring: PluginsQueryStringSchema,
        response: {
          200: ListResponseSchema
        }
      }
    },
    async request => {
      const { type = 'all', force = false } = request.query;

      const local = pluginService.getLocalPlugins();

      if (type === 'installed') {
        return {
          data: {
            items: local,
            total: local.length
          },
          message: '获取插件列表成功'
        };
      }

      const online = await pluginService.getOnlinePlugins(force);
      const installedIds = new Set(local.map(plugin => plugin.meta.id));

      const market = online
        .filter(meta => !installedIds.has(meta.id))
        .map(meta => ({
          meta: meta,
          enabled: false,
          installed: false
        }));

      return {
        data: {
          items: [...local, ...market],
          total: local.length + market.length
        },
        message: '获取插件列表成功'
      };
    }
  );

  // 安装插件
  fastify.post<{ Params: PluginParams }>(
    '/:pluginId/install',
    {
      preHandler: [authenticate, rbac.requireRole('admin')],
      schema: {
        params: PluginSchema,
        response: {
          200: MessageResponseSchema
        }
      }
    },
    async (request, reply) => {
      const pluginId = request.params.pluginId;
      const result = await pluginService.install(pluginId);

      if (!result.success) return reply.badRequest(result.message);
      return { message: '插件安装成功' };
    }
  );

  // 更新插件配置
  fastify.put<{ Params: PluginParams; Body: PluginConfigBody }>(
    '/:pluginId/config',
    {
      preHandler: [authenticate, rbac.requireRole('admin')],
      schema: {
        params: PluginSchema,
        response: {
          200: MessageResponseSchema
        }
      }
    },
    async (request, reply) => {
      const pluginId = request.params.pluginId;
      const config = request.body.config;
      const success = await pluginService.updateConfig(pluginId, config);
      if (!success) return reply.notFound('插件不存在');
      return { message: '插件配置更新成功' };
    }
  );

  // 获取所有运行中的定时任务
  fastify.get(
    '/jobs',
    {
      preHandler: [authenticate, rbac.requireRole('admin')],
      schema: {
        response: {
          200: ListResponseSchema
        }
      }
    },
    async () => {
      const jobs = pluginService.getScheduler().list();

      return {
        message: '获取定时任务列表成功',
        data: {
          items: jobs,
          total: jobs.length
        }
      };
    }
  );
}
