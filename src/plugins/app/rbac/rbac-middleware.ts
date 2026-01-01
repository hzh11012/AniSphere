import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyInstance {
    rbac: ReturnType<typeof createRbacMiddleware>;
  }
}

const createRbacMiddleware = () => {
  return {
    /**
     * 检查是否具有任意一个指定角色
     */
    requireAnyRole(...roleCodes: string[]) {
      return async (request: FastifyRequest, reply: FastifyReply) => {
        const role = request.sessionData!.role;
        if (!roleCodes.includes(role)) {
          return reply.forbidden('权限不足');
        }
      };
    }
  };
};

export default fp(
  async (fastify: FastifyInstance) => {
    const rbac = createRbacMiddleware();
    fastify.decorate('rbac', rbac);
  },
  {
    name: 'rbac-middleware',
    dependencies: ['auth-middleware']
  }
);
