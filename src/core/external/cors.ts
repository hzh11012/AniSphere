import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import cors from '@fastify/cors';

/**
 * This plugin enables the use of CORS with origins from environment variables.
 *
 * @see {@link https://github.com/fastify/fastify-cors}
 */
const corsPlugin = async (fastify: FastifyInstance) => {
  const corsOriginsEnv = fastify.config.CORS_ORIGINS.trim();

  // 如果未配置 CORS_ORIGINS，默认允许同源请求
  const corsOrigins = corsOriginsEnv
    ? corsOriginsEnv
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean)
    : [];

  const CORS_ALLOW_LIST = new Set(corsOrigins);

  // 添加启动时的日志提示
  if (CORS_ALLOW_LIST.size === 0) {
    fastify.log.warn(
      '⚠️  CORS_ORIGINS 未配置或为空，所有跨域请求将被拒绝。' +
        '如需允许跨域访问，请在环境变量中配置 CORS_ORIGINS（多个域名用逗号分隔）'
    );
  }

  await fastify.register(cors, {
    origin: (origin, cb) => {
      // origin 为 undefined 表示同源请求，始终允许
      if (!origin) return cb(null, true);
      // 如果白名单为空，拒绝所有跨域请求
      if (CORS_ALLOW_LIST.size === 0) {
        fastify.log.debug({ origin }, 'CORS 请求被拒绝');
        return cb(null, false);
      }
      // 检查是否在白名单中
      const allowed = CORS_ALLOW_LIST.has(origin);
      if (!allowed) {
        fastify.log.debug({ origin }, 'CORS 请求被拒绝：不在白名单中');
      }
      return cb(null, allowed);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
  });
};

export default fp(corsPlugin, {
  name: 'cors',
  dependencies: ['@fastify/env']
});
