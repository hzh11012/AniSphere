import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { toResult } from '../../../utils/result.js';

declare module 'fastify' {
  interface FastifyInstance {
    codeManager: ReturnType<typeof createCodeManager>;
  }
}

const CODE_PREFIX = 'verify_code:';
const CODE_EXPIRE_SECONDS = 300; // 5分钟

const createCodeManager = (fastify: FastifyInstance) => {
  const redis = fastify.redis;
  const mailManager = fastify.mailManager;
  const config = fastify.config;

  return {
    /**
     * 生成6位数字验证码
     */
    generateCode(): string {
      return Math.floor(100000 + Math.random() * 900000).toString();
    },

    /**
     * 存储验证码
     */
    async storeCode(email: string, code: string) {
      return toResult(
        Promise.all([
          redis.setex(`${CODE_PREFIX}${email}`, CODE_EXPIRE_SECONDS, code)
        ]).then(() => undefined)
      );
    },

    /**
     * 生成、存储并发送验证码
     */
    async sendCode(email: string) {
      const code = this.generateCode();

      // 存储验证码
      const storeResult = await this.storeCode(email, code);
      if (storeResult.isErr()) {
        return storeResult;
      }

      // 开发环境只打印日志，不发送邮件
      if (config.NODE_ENV === 'development') {
        fastify.log.info(`[DEV] 验证码: ${code} -> ${email}`);
        return toResult(Promise.resolve(code));
      }

      // 生产环境发送邮件
      const sendResult = await mailManager.sendVerificationCode(email, code);
      if (sendResult.isErr()) {
        // 发送失败时删除已存储的验证码
        await redis.del(`${CODE_PREFIX}${email}`);
        return sendResult;
      }

      return toResult(Promise.resolve(code));
    },

    /**
     * 验证验证码
     */
    async verifyCode(email: string, code: string) {
      return toResult(
        redis.get(`${CODE_PREFIX}${email}`).then(async storedCode => {
          if (!storedCode || storedCode !== code) {
            return false;
          }
          // 验证成功后删除验证码（一次性使用）
          await redis.del(`${CODE_PREFIX}${email}`);
          return true;
        })
      );
    }
  };
};

export default fp(
  async (fastify: FastifyInstance) => {
    const repo = createCodeManager(fastify);
    fastify.decorate('codeManager', repo);
  },
  {
    name: 'code-manager',
    dependencies: ['redis', 'mail-manager']
  }
);
