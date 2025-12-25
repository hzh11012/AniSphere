import { FastifyInstance } from 'fastify';

import { MessageResponseSchema } from '../../schemas/common.js';

export default async function (fastify: FastifyInstance) {
  fastify.get(
    '/',
    {
      schema: {
        response: {
          200: MessageResponseSchema
        }
      }
    },
    () => ({ message: 'Welcome to the official fastify template!!!' })
  );
}
