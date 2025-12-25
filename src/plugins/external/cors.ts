import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import cors from '@fastify/cors';

/**
 * This plugin enables the use of CORS with origins from environment variables.
 *
 * @see {@link https://github.com/fastify/fastify-cors}
 */
const plugin: FastifyPluginAsync = async fastify => {
  const corsOriginsEnv = fastify.config.CORS_ORIGINS.trim();

  // 如果未配置 CORS_ORIGINS，默认允许同源请求
  const corsOrigins = corsOriginsEnv
    ? corsOriginsEnv
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean)
    : [];

  const CORS_ALLOW_LIST = new Set(corsOrigins);

  await fastify.register(cors, {
    origin: (origin, cb) => {
      // origin 为 undefined 表示同源请求，始终允许
      if (!origin) return cb(null, true);
      // 如果白名单为空，拒绝所有跨域请求
      if (CORS_ALLOW_LIST.size === 0) return cb(null, false);
      // 检查是否在白名单中
      return cb(null, CORS_ALLOW_LIST.has(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  });
};

export default fp(plugin, {
  name: 'cors',
  dependencies: ['@fastify/env']
});
