import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { toResult } from '../../../utils/result.js';

declare module 'fastify' {
  interface FastifyInstance {
    codeRepository: ReturnType<typeof createCodeRepository>;
  }
}

const CODE_PREFIX = 'verify_code:';
const CODE_EXPIRE_SECONDS = 300; // 5分钟

const createCodeRepository = (fastify: FastifyInstance) => {
  const redis = fastify.redis;

  return {
    /**
     * 存储验证码
     */
    async store(email: string, code: string) {
      return toResult(
        redis
          .setex(`${CODE_PREFIX}${email}`, CODE_EXPIRE_SECONDS, code)
          .then(() => undefined)
      );
    },

    /**
     * 获取验证码
     */
    async get(email: string) {
      return toResult(redis.get(`${CODE_PREFIX}${email}`));
    },

    /**
     * 删除验证码
     */
    async delete(email: string) {
      return toResult(
        redis.del(`${CODE_PREFIX}${email}`).then(() => undefined)
      );
    }
  };
};

export default fp(
  async (fastify: FastifyInstance) => {
    const repo = createCodeRepository(fastify);
    fastify.decorate('codeRepository', repo);
  },
  {
    name: 'code-repository',
    dependencies: ['redis']
  }
);
