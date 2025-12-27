import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';

/**
 * Cookie plugin with secret from fastify config
 * @see {@link https://github.com/fastify/fastify-cookie}
 */
const cookiePlugin = async (fastify: FastifyInstance) => {
  await fastify.register(cookie, {
    secret: fastify.config.SESSION_SECRET,
    parseOptions: {}
  });
};

export default fp(cookiePlugin, {
  name: 'cookie',
  dependencies: ['@fastify/env']
});
