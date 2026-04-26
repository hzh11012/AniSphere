import type { FastifyInstance } from 'fastify';
import { SuccessResponseSchema } from '../../../../schemas/common.js';
import {
  type UserListQuery,
  UserListSchema,
  UserListSchemaResponse,
  type UpdateUserParams,
  UpdateUserParamsSchema,
  type UpdateUserBody,
  UpdateUserBodySchema
} from '../../../../schemas/users.js';

export default async function (fastify: FastifyInstance) {
  const { authenticate, rbac, usersRepository, sessionRepository, log } =
    fastify;

  /** 用户列表 */
  fastify.get<{ Querystring: UserListQuery }>(
    '/',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        querystring: UserListSchema,
        response: {
          200: SuccessResponseSchema(UserListSchemaResponse)
        }
      }
    },
    async (request, reply) => {
      const { page, pageSize, keyword, role, status, sort, order } =
        request.query;

      const result = await usersRepository.findAll({
        page,
        pageSize,
        keyword,
        role,
        status,
        sort,
        order
      });

      if (result.isErr()) {
        log.error({ error: result.error }, 'Failed to get users');
        return reply.internalServerError('获取用户列表失败');
      }

      return reply.success('获取用户列表成功', result.value);
    }
  );

  /** 更新用户 */
  fastify.put<{ Params: UpdateUserParams; Body: UpdateUserBody }>(
    '/:id',
    {
      preHandler: [authenticate, rbac.requireAnyRole('admin')],
      schema: {
        params: UpdateUserParamsSchema,
        body: UpdateUserBodySchema,
        response: {
          200: SuccessResponseSchema()
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params;
      const { role, status } = request.body;

      const existing = await usersRepository.findById(id);
      if (existing.isErr()) {
        log.error({ error: existing.error }, 'Failed to find user');
        return reply.internalServerError('更新用户失败');
      }

      if (!existing.value) {
        return reply.notFound('用户不存在');
      }

      const result = await usersRepository.update(id, request.body);

      if (result.isErr()) {
        log.error({ error: result.error }, 'Failed to update user');
        return reply.internalServerError('更新用户失败');
      }

      // 同步更新 session 中的角色和状态
      if (role !== undefined) {
        const roleResult = await sessionRepository.refreshUserSessionsRole(
          id,
          role
        );
        if (roleResult.isErr()) {
          log.error({ error: roleResult.error }, 'Failed to sync session role');
        }
      }

      if (status !== undefined) {
        const statusResult = await sessionRepository.refreshUserSessionsStatus(
          id,
          status
        );
        if (statusResult.isErr()) {
          log.error(
            { error: statusResult.error },
            'Failed to sync session status'
          );
        }
      }

      return reply.success('更新用户成功');
    }
  );
}
