import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import type { SessionData } from './session-repository.js';

declare module 'fastify' {
  interface FastifyRequest {
    session: SessionData | null;
    sessionToken: string | null;
    userId: number | null;
    roles: string[] | null;
    permissions: string[] | null;
  }

  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
  }
}

const createAuthMiddleware = (fastify: FastifyInstance) => {
  const { sessionRepository } = fastify;

  return async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionCookie = request.cookies.sessionToken;

    if (!sessionCookie) {
      return reply.unauthorized('未登录');
    }

    const unsigned = request.unsignCookie(sessionCookie);

    // 签名无效
    if (!unsigned.valid) {
      reply.clearCookie('sessionToken', { path: '/' });
      return reply.unauthorized('无效的会话');
    }

    const sessionToken = unsigned.value;

    if (!sessionToken) {
      return reply.unauthorized('未登录');
    }

    const sessionResult = await sessionRepository.getSession(sessionToken);

    if (sessionResult.isErr()) {
      fastify.log.error(
        { error: sessionResult.error },
        'Failed to get session'
      );
      return reply.internalServerError('服务器错误');
    }

    const session = sessionResult.value;

    if (!session) {
      reply.clearCookie('sessionToken', { path: '/' });
      return reply.unauthorized('会话已过期');
    }

    if (!session.status) {
      reply.clearCookie('sessionToken', { path: '/' });
      return reply.unauthorized('账号已禁用');
    }

    // 自动续签
    if (sessionRepository.shouldRenew(session)) {
      const renewResult = await sessionRepository.renewSession(
        sessionToken,
        session
      );

      if (renewResult.isOk()) {
        const cookieOptions = sessionRepository.getCookieOptions();
        reply.setCookie('sessionToken', sessionToken, cookieOptions);
      }
    }

    request.session = session;
    request.sessionToken = sessionToken;
    request.userId = session.userId;
    request.roles = session.roles;
    request.permissions = session.permissions;
  };
};

export default fp(
  async (fastify: FastifyInstance) => {
    // 装饰 request
    fastify.decorateRequest('session', null);
    fastify.decorateRequest('sessionToken', null);
    fastify.decorateRequest('userId', null);
    fastify.decorateRequest('roles', null);
    fastify.decorateRequest('permissions', null);

    const authenticate = createAuthMiddleware(fastify);
    fastify.decorate('authenticate', authenticate);
  },
  {
    name: 'auth-middleware',
    dependencies: ['session-repository', '@fastify/cookie']
  }
);
