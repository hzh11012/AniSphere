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
  }),
  redis: Type.Object({
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
        },
        redis: {
          status: 'ok' as string,
          latency: undefined as number | undefined
        }
      };

      // 检查数据库
      try {
        const start = Date.now();
        await fastify.db.$client.query('SELECT 1');
        health.database.latency = Date.now() - start;
        health.database.status = 'ok';
      } catch (err) {
        health.status = 'degraded';
        health.database.status = 'error';
        request.log.error(err, 'Database health check failed');
        return reply.serviceUnavailable().send(health);
      }

      // 检查 Redis
      try {
        const start = Date.now();
        await fastify.redis.ping();
        health.redis.latency = Date.now() - start;
        health.redis.status = 'ok';
      } catch (err) {
        health.status = 'degraded';
        health.redis.status = 'error';
        request.log.error(err, 'Redis health check failed');
      }

      // 如果有任何服务不可用，则返回 503
      if (health.status === 'degraded') {
        return reply.serviceUnavailable().send(health);
      }

      return health;
    }
  );
}
