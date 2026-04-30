import type { FastifyInstance } from 'fastify';
import { SuccessResponseSchema } from '../../../../schemas/common.js';
import { SettingsInfoSchemaResponse } from '../../../../schemas/settings.js';

export default async function (fastify: FastifyInstance) {
  const { authenticate, rbac, config, ffmpegService } = fastify;

  fastify.get(
    '/info',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        response: { 200: SuccessResponseSchema(SettingsInfoSchemaResponse) }
      }
    },
    async (_request, reply) => {
      return reply.success('获取系统信息成功', {
        server: {
          nodeVersion: process.version,
          environment: config.NODE_ENV,
          uptime: process.uptime()
        },
        ffmpeg: {
          encoder: ffmpegService.getEncoderInfo().name,
          threads: config.FFMPEG_THREADS,
          hlsSegmentTime: config.FFMPEG_HLS_SEGMENT_TIME,
          transcodePath: config.FFMPEG_TRANSCODE_OUTPUT_PATH,
          activeCount: ffmpegService.getActiveCount(),
          queueLength: ffmpegService.getQueueLength()
        },
        qbit: {
          host: config.QBIT_HOST,
          downloadPath: config.QBIT_DOWNLOAD_PATH
        },
        smtp: {
          host: config.SMTP_HOST,
          port: config.SMTP_PORT,
          from: config.SMTP_FROM
        },
        database: {
          poolMax: config.DB_POOL_MAX,
          poolIdleTimeout: config.DB_POOL_IDLE_TIMEOUT,
          poolConnectionTimeout: config.DB_POOL_CONNECTION_TIMEOUT
        },
        session: {
          maxAge: config.SESSION_MAX_AGE,
          renewThreshold: config.SESSION_RENEW_THRESHOLD,
          domain: config.SESSION_DOMAIN
        },
        security: {
          rateLimitMax: config.RATE_LIMIT_MAX,
          corsOrigins: config.CORS_ORIGINS
        }
      });
    }
  );

  fastify.delete(
    '/cache',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        response: { 200: SuccessResponseSchema() }
      }
    },
    async (_request, reply) => {
      await fastify.redis.del('dashboard:stats');
      return reply.success('缓存已清除');
    }
  );
}
