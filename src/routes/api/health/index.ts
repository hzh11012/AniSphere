import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';

const HealthResponseSchema = Type.Object({
  status: Type.String(),
  timestamp: Type.Number(),
  uptime: Type.Number(),
  environment: Type.String(),
  database: Type.Object({
    status: Type.String(),
    latency: Type.Optional(Type.Number())
  })
});

export default async function (fastify: FastifyInstance) {
  fastify.get(
    '/',
    {
      schema: {
        description: 'Health check endpoint',
        tags: ['Health'],
        response: {
          200: HealthResponseSchema,
          503: HealthResponseSchema
        }
      }
    },
    async (request, reply) => {
      const health = {
        status: 'ok',
        timestamp: Date.now(),
        uptime: process.uptime(),
        environment: fastify.config.NODE_ENV,
        database: {
          status: 'ok' as string,
          latency: undefined as number | undefined
        }
      };

      try {
        const start = Date.now();
        await fastify.db.$client.query('SELECT 1');
        health.database.latency = Date.now() - start;
        health.database.status = 'ok';
      } catch (err) {
        health.status = 'degraded';
        health.database.status = 'error';
        request.log.error(err, 'Database health check failed');
        return reply.code(503).send(health);
      }

      return health;
    }
  );
}
