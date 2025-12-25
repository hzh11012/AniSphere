import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import fastifyRateLimit from '@fastify/rate-limit';

/**
 * This plugins is low overhead rate limiter for your routes.
 *
 * @see {@link https://github.com/fastify/fastify-rate-limit}
 */
const rateLimitPlugin: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  await fastify.register(fastifyRateLimit, {
    max: fastify.config.RATE_LIMIT_MAX,
    timeWindow: '1 minute'
  });
};

export default fp(rateLimitPlugin, {
  name: 'rate-limit',
  dependencies: ['@fastify/env']
});
