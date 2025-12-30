import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { and, eq } from 'drizzle-orm';
import {
  rolesTable,
  permissionsTable,
  userRolesTable,
  rolePermissionsTable
} from '../../../db/schema.js';
import { err, toResult } from '../../../utils/result.js';

declare module 'fastify' {
  interface FastifyInstance {
    rbacRepository: ReturnType<typeof createRbacRepository>;
  }
}

const createRbacRepository = (fastify: FastifyInstance) => {
  const { db, sessionRepository } = fastify;

  return {
    /**
     * 获取用户所有角色
     */
    async getUserRoles(userId: number) {
      return toResult(
        db
          .select({
            id: rolesTable.id,
            name: rolesTable.name,
            code: rolesTable.code
          })
          .from(userRolesTable)
          .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
          .where(eq(userRolesTable.userId, userId))
      );
    },

    /**
     * 获取角色所有权限
     */
    async getUserPermissions(userId: number) {
      return toResult(
        db
          .selectDistinct({
            id: permissionsTable.id,
            name: permissionsTable.name,
            code: permissionsTable.code
          })
          .from(userRolesTable)
          .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
          .innerJoin(
            rolePermissionsTable,
            eq(rolesTable.id, rolePermissionsTable.roleId)
          )
          .innerJoin(
            permissionsTable,
            eq(rolePermissionsTable.permissionId, permissionsTable.id)
          )
          .where(eq(userRolesTable.userId, userId))
      );
    },

    /**
     * 分配角色
     */
    async assignRoles(userId: number, roleCode: string = 'guest') {
      const roleResult = await toResult(
        db
          .select({ id: rolesTable.id })
          .from(rolesTable)
          .where(eq(rolesTable.code, roleCode))
          .limit(1)
          .then(roles => roles[0] ?? null)
      );

      if (roleResult.isErr()) return roleResult;
      if (!roleResult.value) {
        return err(new Error('角色不存在'));
      }

      const insertResult = await toResult(
        db
          .insert(userRolesTable)
          .values({
            userId,
            roleId: roleResult.value.id
          })
          .onConflictDoNothing()
          .then(() => undefined)
      );

      if (insertResult.isErr()) return insertResult;

      await sessionRepository.deleteUserPermissions(userId);

      return insertResult;
    },

    /**
     * 移除角色
     */
    async removeRole(userId: number, roleCode: string) {
      const roleResult = await toResult(
        db
          .select({ id: rolesTable.id })
          .from(rolesTable)
          .where(eq(rolesTable.code, roleCode))
          .limit(1)
          .then(roles => roles[0] ?? null)
      );

      if (roleResult.isErr()) return roleResult;
      if (!roleResult.value) {
        return err(new Error('角色不存在'));
      }

      const deleteResult = await toResult(
        db
          .delete(userRolesTable)
          .where(
            and(
              eq(userRolesTable.userId, userId),
              eq(userRolesTable.roleId, roleResult.value.id)
            )
          )
          .then(() => undefined)
      );

      if (deleteResult.isErr()) return deleteResult;

      await sessionRepository.deleteUserPermissions(userId);

      return deleteResult;
    }
  };
};

export default fp(
  async (fastify: FastifyInstance) => {
    const repo = createRbacRepository(fastify);
    fastify.decorate('rbacRepository', repo);
  },
  {
    name: 'rbac-repository',
    dependencies: ['db', 'session-repository']
  }
);
