import { FastifyInstance } from 'fastify';
import { SendCodeSchema, LoginSchema } from '../../../schemas/auth.js';
import { MessageResponseSchema } from '../../../schemas/common.js';
import { Static } from '@sinclair/typebox';

type SendCodeBody = Static<typeof SendCodeSchema>;
type LoginBody = Static<typeof LoginSchema>;

export default async function (fastify: FastifyInstance) {
  const { codeManager, usersRepository, sessionManager } = fastify;

  fastify.post<{ Body: SendCodeBody }>(
    '/send-code',
    {
      schema: {
        body: SendCodeSchema,
        response: {
          200: MessageResponseSchema
        }
      }
    },
    async request => {
      const { email } = request.body;

      await codeManager.sendCode(email);

      return { message: '验证码已发送到您的邮箱' };
    }
  );

  fastify.post<{ Body: LoginBody }>(
    '/login',
    {
      schema: {
        body: LoginSchema,
        response: {
          200: MessageResponseSchema
        }
      }
    },
    async (request, reply) => {
      const { email, code } = request.body;

      // 验证验证码
      const verifyResult = await codeManager.verifyCode(email, code);
      if (verifyResult.isErr()) {
        return reply.internalServerError('服务器错误');
      }

      if (!verifyResult.value) {
        return reply.unauthorized('验证码错误或已过期');
      }

      // 获取用户信息
      const userResult = await usersRepository.findByEmail(email);
      if (userResult.isErr()) {
        return reply.internalServerError('服务器错误');
      }

      const user = userResult.value;

      // 如果用户不存在，自动注册
      if (!user) {
        const defaultName = `用户${Math.floor(100000 + Math.random() * 900000).toString()}`;

        const createResult = await usersRepository.create({
          email,
          name: defaultName
        });

        if (createResult.isErr()) {
          return reply.internalServerError('创建用户失败');
        }
      }

      // 创建 session
      const sessionResult = await sessionManager.createSession(
        user.id,
        user.email
      );
      if (sessionResult.isErr()) {
        return reply.internalServerError('服务器错误');
      }

      const sessionId = sessionResult.value;
      // 设置 cookie
      reply.setCookie(
        'sessionId',
        sessionId,
        sessionManager.getCookieOptions()
      );

      return {
        message: '登录成功'
      };
    }
  );
}
