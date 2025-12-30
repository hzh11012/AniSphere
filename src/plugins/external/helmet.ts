import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';

/**
 * This plugin sets the basic security headers.
 *
 * @see {@link https://github.com/fastify/fastify-helmet}
 */
const helmetPlugin = async (fastify: FastifyInstance) => {
  await fastify.register(helmet, {
    contentSecurityPolicy: false
  });
};

export default fp(helmetPlugin, {
  name: 'helmet'
});
