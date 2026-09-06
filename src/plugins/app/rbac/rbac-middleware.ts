import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import type { AnimeType } from '../../../db/index.js';

declare module 'fastify' {
  interface FastifyRequest {
    excludeTypes: AnimeType[] | undefined;
  }

  interface FastifyInstance {
    rbac: ReturnType<typeof createRbacMiddleware>;
  }
}

const ADULT_ALLOWED_ROLES = ['admin', 'premium'];

const createRbacMiddleware = () => {
  return {
    requireAnyRole(...roleCodes: string[]) {
      return async (request: FastifyRequest, reply: FastifyReply) => {
        const role = request.sessionData!.role;
        if (!roleCodes.includes(role)) {
          return reply.forbidden('权限不足');
        }
      };
    },

    filterAdultTypes() {
      return async (request: FastifyRequest) => {
        request.excludeTypes = ADULT_ALLOWED_ROLES.includes(
          request.sessionData!.role
        )
          ? undefined
          : (['adult'] as AnimeType[]);
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
