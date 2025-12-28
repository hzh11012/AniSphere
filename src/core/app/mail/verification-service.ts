import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { randomInt } from 'node:crypto';
import { ok } from '../../../utils/result.js';

declare module 'fastify' {
  interface FastifyInstance {
    verificationService: ReturnType<typeof createVerificationService>;
  }
}

const createVerificationService = (fastify: FastifyInstance) => {
  const codeRepository = fastify.codeRepository;
  const mailService = fastify.mailService;
  const config = fastify.config;

  return {
    /**
     * 生成6位数字验证码
     */
    generateCode(): string {
      return randomInt(100000, 1000000).toString();
    },

    /**
     * 生成、存储并发送验证码
     */
    async sendVerificationCode(email: string) {
      const code = this.generateCode();

      // 存储验证码
      const storeResult = await codeRepository.store(email, code);
      if (storeResult.isErr()) {
        return storeResult;
      }

      // 开发环境只打印日志，不发送邮件
      if (config.NODE_ENV === 'development') {
        fastify.log.info(`[DEV] 验证码: ${code} -> ${email}`);
        return ok(true);
      }

      // 生产环境发送邮件
      const sendResult = await mailService.sendVerificationCode(email, code);
      if (sendResult.isErr()) {
        fastify.log.error(
          { error: sendResult.error },
          'Failed to send verification code'
        );

        // 发送失败时删除已存储的验证码
        const deleteResult = await codeRepository.delete(email);
        if (deleteResult.isErr()) {
          fastify.log.error(
            { error: deleteResult.error },
            'Failed to delete code after sending mail failed'
          );
        }
        return sendResult;
      }

      return ok(true);
    },

    /**
     * 验证验证码
     */
    async verifyCode(email: string, code: string) {
      const getResult = await codeRepository.get(email);

      if (getResult.isErr()) {
        return getResult;
      }

      const storedCode = getResult.value;

      if (!storedCode || storedCode !== code) {
        return ok(false);
      }

      // 验证成功后删除验证码（一次性使用）
      await codeRepository.delete(email);
      return ok(true);
    }
  };
};

export default fp(
  async (fastify: FastifyInstance) => {
    const service = createVerificationService(fastify);
    fastify.decorate('verificationService', service);
  },
  {
    name: 'verification-service',
    dependencies: ['code-repository', 'mail-service', '@fastify/env']
  }
);
