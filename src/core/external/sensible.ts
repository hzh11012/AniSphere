import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import sensible from '@fastify/sensible';

/**
 * This plugin adds some utilities to handle http errors.
 *
 * @see {@link https://github.com/fastify/fastify-sensible}
 */
const sensiblePlugin = async (fastify: FastifyInstance) => {
  await fastify.register(sensible);
};

export default fp(sensiblePlugin, {
  name: 'sensible'
});
