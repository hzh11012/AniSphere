import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import type { SessionData } from './session-manager.js';

declare module 'fastify' {
  interface FastifyRequest {
    session: SessionData | null;
    userId: number | null;
  }

  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
  }
}

const createAuthMiddleware = (fastify: FastifyInstance) => {
  const sessionManager = fastify.sessionManager;

  return async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionId = request.cookies.sessionId;

    if (!sessionId) {
      return reply.code(401).send({ message: '未登录' });
    }

    const sessionResult = await sessionManager.getSession(sessionId);

    if (sessionResult.isErr()) {
      fastify.log.error(
        { error: sessionResult.error },
        'Failed to get session'
      );
      return reply.code(500).send({ message: '服务器错误' });
    }

    const session = sessionResult.value;

    if (!session) {
      reply.clearCookie('sessionId', { path: '/' });
      return reply.code(401).send({ message: '会话已过期' });
    }

    // 自动续签
    if (sessionManager.shouldRenew(session)) {
      const renewResult = await sessionManager.renewSession(sessionId, session);

      if (renewResult.isOk()) {
        reply.setCookie(
          'sessionId',
          sessionId,
          sessionManager.getCookieOptions()
        );
      }
    }

    request.session = session;
    request.userId = session.userId;
  };
};

export default fp(
  async (fastify: FastifyInstance) => {
    // 装饰 request
    fastify.decorateRequest('session', null);
    fastify.decorateRequest('userId', null);

    const authenticate = createAuthMiddleware(fastify);
    fastify.decorate('authenticate', authenticate);
  },
  {
    name: 'auth-middleware',
    dependencies: ['session-manager', '@fastify/cookie']
  }
);
