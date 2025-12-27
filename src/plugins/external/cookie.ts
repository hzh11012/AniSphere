import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';

/**
 * Cookie plugin with secret from fastify config
 * @see {@link https://github.com/fastify/fastify-cookie}
 */
export default fp(
  async (fastify: FastifyInstance) => {
    await fastify.register(cookie, {
      secret: fastify.config.SESSION_SECRET,
      parseOptions: {}
    });
  },
  {
    name: 'cookie',
    dependencies: ['@fastify/env']
  }
);
