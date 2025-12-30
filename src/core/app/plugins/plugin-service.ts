import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { PluginManager } from './plugin-manager.js';

declare module 'fastify' {
  interface FastifyInstance {
    pluginService: PluginManager;
  }
}

const createPluginService = async (fastify: FastifyInstance) => {
  const service = PluginManager.getInstance();
  await service.init(fastify);

  fastify.decorate('pluginService', service);

  fastify.addHook('onClose', async () => {
    await service.stopAll();
    fastify.log.info('[PluginManager] All plugins stopped');
  });
};

export default fp(createPluginService, {
  name: 'plugin-service',
  dependencies: ['@fastify/env', 'redis', 'rbac-middleware']
});
