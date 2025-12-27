import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { eq, sql } from 'drizzle-orm';
import {
  rolesTable,
  permissionsTable,
  userRolesTable,
  rolePermissionsTable,
  usersTable
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
     * 刷新用户会话权限
     */
    async refreshUserSessionPermissions(userId: number) {
      // 获取最新的角色和权限
      const [rolesResult, permissionsResult] = await Promise.all([
        this.getUserRoles(userId),
        this.getUserPermissions(userId)
      ]);

      if (rolesResult.isErr()) return rolesResult;
      if (permissionsResult.isErr()) return permissionsResult;

      const roles = rolesResult.value.map(r => r.code);
      const permissions = permissionsResult.value.map(p => p.code);

      return sessionRepository.refreshUserSessionsPermissions(
        userId,
        roles,
        permissions
      );
    },

    /**
     * 检查是否是第一个用户
     */
    async isFirstUser() {
      return toResult(
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(usersTable)
          .then(result => result[0]?.count === 1)
      );
    },

    /**
     * 分配角色
     */
    async assignDefaultRoles(userId: number, roleCode: string = 'user') {
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

      return toResult(
        db
          .insert(userRolesTable)
          .values({
            userId,
            roleId: roleResult.value.id
          })
          .onConflictDoNothing()
          .then(() => undefined)
      );
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
