import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import csrf from '@fastify/csrf-protection';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF protection plugin
 *
 * 工作机制：
 * 1. 插件内部用 _csrf Cookie 存储 secret（httpOnly: true，不可被 JS 读取）
 * 2. 每次响应时将 generateCsrf() 生成的 token 写入 XSRF-TOKEN Cookie（httpOnly: false，前端可读）
 * 3. 前端 axios 配置 xsrfCookieName: 'XSRF-TOKEN', xsrfHeaderName: 'X-XSRF-TOKEN'
 *    自动从 Cookie 读取 Token 并附加到请求头
 * 4. 写操作（POST/PUT/DELETE/PATCH）时校验 X-XSRF-TOKEN 请求头中的 Token
 *
 * @see {@link https://github.com/fastify/csrf-protection}
 */
const csrfPlugin = async (fastify: FastifyInstance) => {
  const isProduction = fastify.config.NODE_ENV === 'production';

  // 注册 csrf-protection 插件
  // cookieKey: secret 存储的 Cookie 名（内部使用，httpOnly: true）
  // getToken: 默认已检查 x-xsrf-token header，无需自定义
  await fastify.register(csrf, {
    cookieKey: '_csrf',
    cookieOpts: {
      path: '/',
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const,
      signed: false,
      domain: fastify.config.SESSION_DOMAIN
    }
  });

  // XSRF-TOKEN Cookie 配置（前端可读）
  const xsrfCookieOpts = {
    path: '/',
    httpOnly: false,
    secure: isProduction,
    sameSite: 'lax' as const,
    domain: fastify.config.SESSION_DOMAIN
  };

  fastify.addHook('onRequest', (request, reply, done) => {
    // 跳过 webhook 路径的 CSRF 检查（第三方回调）
    if (request.url.startsWith('/api/webhook/')) {
      return done();
    }

    if (SAFE_METHODS.has(request.method)) {
      // 安全方法：生成 Token 并种 XSRF-TOKEN Cookie，供后续写操作使用
      const token = reply.generateCsrf();
      reply.setCookie('XSRF-TOKEN', token, xsrfCookieOpts);
      return done();
    }

    // 写操作：校验 CSRF Token
    fastify.csrfProtection(request, reply, done);
  });
};

export default fp(csrfPlugin, {
  name: 'csrf',
  dependencies: ['@fastify/env', 'cookie']
});
