import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { Redis, type Redis as RedisClient } from 'ioredis';

declare module 'fastify' {
  export interface FastifyInstance {
    redis: RedisClient;
  }
}

/**
 * This plugin adds a Redis client to your app.
 *
 * @see {@link https://github.com/redis/node-redis}
 */
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

  redis.on('ready', () => {
    fastify.log.info('Redis connection ready');
  });

  redis.on('error', err => {
    fastify.log.error({ err }, 'Redis connection error');
  });

  redis.on('close', () => {
    fastify.log.warn('Redis connection closed');
  });

  redis.on('reconnecting', (delay: number) => {
    fastify.log.info({ delay }, 'Redis reconnecting...');
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
