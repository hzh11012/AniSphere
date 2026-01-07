import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { MonitorClient } from './monitor-client.js';

declare module 'fastify' {
  export interface FastifyInstance {
    monitor: MonitorClient;
  }
}

const monitorPlugin = async (fastify: FastifyInstance) => {
  const monitor = new MonitorClient(fastify);
  fastify.decorate('monitor', monitor);

  fastify.addHook('onReady', async () => {
    monitor.start();
  });

  fastify.addHook('onClose', async () => {
    monitor.stop();
  });
};

export default fp(monitorPlugin, {
  name: 'monitor',
  dependencies: ['@fastify/env', 'db', 'qbit']
});
