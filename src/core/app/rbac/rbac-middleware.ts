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
     * 检查是否具有指定权限
     */
    requirePermission(permissionCode: string) {
      return async (request: FastifyRequest, reply: FastifyReply) => {
        const { permissions } = request;
        if (!permissions?.includes(permissionCode)) {
          return reply.forbidden('权限不足');
        }
      };
    },

    /**
     * 检查是否具有指定角色
     */
    requireRole(roleCode: string) {
      return async (request: FastifyRequest, reply: FastifyReply) => {
        const { roles } = request;
        if (!roles?.includes(roleCode)) {
          return reply.forbidden('权限不足');
        }
      };
    },

    /**
     * 检查是否具有任意一个指定权限
     */
    requireAnyPermission(...permissionCodes: string[]) {
      return async (request: FastifyRequest, reply: FastifyReply) => {
        const { permissions } = request;
        if (!permissionCodes.some(code => permissions?.includes(code))) {
          return reply.forbidden('权限不足');
        }
      };
    },

    /**
     * 检查是否具有任意一个指定角色
     */
    requireAnyRole(...roleCodes: string[]) {
      return async (request: FastifyRequest, reply: FastifyReply) => {
        const { roles } = request;
        if (!roleCodes.some(code => roles?.includes(code))) {
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
