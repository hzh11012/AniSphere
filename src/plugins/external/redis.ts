import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { Redis, type Redis as RedisClient } from 'ioredis';

declare module 'fastify' {
  export interface FastifyInstance {
    redis: RedisClient;
  }
}

const redisPlugin = async (fastify: FastifyInstance) => {
  const redis = new Redis(fastify.config.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy: times => {
      // 重试延迟策略：最小 100ms，最大 3000ms
      return Math.min(times * 100, 3000);
    }
  });

  redis.on('connect', () => {
    fastify.log.info('Redis connecting');
  });

  fastify.decorate('redis', redis);

  fastify.addHook('onClose', async () => {
    try {
      await redis.quit();
      fastify.log.info('Redis connection closed');
    } catch (error) {
      fastify.log.warn({ error }, 'Redis quit failed');
    }
  });
};

export default fp(redisPlugin, {
  name: 'redis',
  dependencies: ['@fastify/env']
});
