import { FastifyInstance } from 'fastify';
import {
  SendCodeSchema,
  LoginSchema,
  type SendCodeBody,
  type LoginBody
} from '../../../schemas/auth.js';
import { SuccessResponseSchema } from '../../../schemas/common.js';

export default async function (fastify: FastifyInstance) {
  const {
    authenticate,
    verificationService,
    usersRepository,
    sessionRepository,
    rbacRepository
  } = fastify;

  fastify.post<{ Body: SendCodeBody }>(
    '/send-code',
    {
      schema: {
        body: SendCodeSchema,
        response: {
          200: SuccessResponseSchema()
        }
      }
    },
    async (request, reply) => {
      const { email } = request.body;

      const sendResult = await verificationService.sendVerificationCode(email);

      if (sendResult.isErr()) {
        fastify.log.error(
          { error: sendResult.error },
          'Failed to send verification code'
        );
        return reply.internalServerError('验证码发送失败，请稍后重试');
      }

      return reply.success('验证码已发送到您的邮箱');
    }
  );

  fastify.post<{ Body: LoginBody }>(
    '/login',
    {
      schema: {
        body: LoginSchema,
        response: {
          200: SuccessResponseSchema()
        }
      }
    },
    async (request, reply) => {
      const { email, code } = request.body;

      // 验证验证码
      const verifyResult = await verificationService.verifyCode(email, code);
      if (verifyResult.isErr()) {
        fastify.log.error(
          { error: verifyResult.error },
          'Failed to verify code'
        );
        return reply.internalServerError('服务器错误');
      }

      if (!verifyResult.value) {
        return reply.unauthorized('验证码错误或已过期');
      }

      // 获取用户信息
      const userResult = await usersRepository.findOrCreate(email);
      if (userResult.isErr()) {
        fastify.log.error(
          { error: userResult.error },
          'Failed to find or create user'
        );
        return reply.internalServerError('服务器错误');
      }

      const user = userResult.value;

      // 获取用户角色和权限
      const [rolesResult, permissionsResult] = await Promise.all([
        rbacRepository.getUserRoles(user.id),
        rbacRepository.getUserPermissions(user.id)
      ]);

      if (rolesResult.isErr()) {
        fastify.log.error(
          { error: rolesResult.error },
          'Failed to get user roles'
        );
        return reply.internalServerError('服务器错误');
      }

      if (permissionsResult.isErr()) {
        fastify.log.error(
          { error: permissionsResult.error },
          'Failed to get user permissions'
        );
        return reply.internalServerError('服务器错误');
      }

      const roles = rolesResult.value.map(r => r.code);
      const permissions = permissionsResult.value.map(p => p.code);

      // 创建 session
      const sessionResult = await sessionRepository.createSession(
        user.id,
        user.email,
        user.status,
        roles,
        permissions
      );

      if (sessionResult.isErr()) {
        fastify.log.error(
          { error: sessionResult.error },
          'Failed to create session'
        );
        return reply.internalServerError('服务器错误');
      }

      const sessionToken = sessionResult.value;
      const cookieOptions = sessionRepository.getCookieOptions();
      // 设置 cookie
      reply.setCookie('sessionToken', sessionToken, cookieOptions);

      return reply.success('登录成功');
    }
  );

  fastify.post(
    '/logout',
    {
      preHandler: [authenticate],
      schema: {
        response: {
          200: SuccessResponseSchema()
        }
      }
    },
    async (request, reply) => {
      const sessionToken = request.sessionToken;

      if (sessionToken) {
        const deleteResult =
          await sessionRepository.deleteSession(sessionToken);
        if (deleteResult.isErr()) {
          fastify.log.warn(
            { error: deleteResult.error },
            'Failed to delete session'
          );
        }
      }

      reply.clearCookie('sessionToken', { path: '/' });

      return reply.success('登出成功');
    }
  );
}
