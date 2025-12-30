import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import {
  rolesTable,
  permissionsTable,
  rolePermissionsTable
} from '../../../db/schema.js';
import {
  defaultRoles,
  defaultPermissions,
  rolePermissionMapping
} from '../../../db/seeds/rbac-seeds.js';

declare module 'fastify' {
  interface FastifyInstance {
    rbacSeeder: {
      seed: () => Promise<void>;
      isSeeded: () => Promise<boolean>;
    };
  }
}

const createRbacSeeder = (fastify: FastifyInstance) => {
  const { db } = fastify;

  return {
    /**
     * 检查是否已经初始化过
     */
    async isSeeded(): Promise<boolean> {
      const roles = await db
        .select({ id: rolesTable.id })
        .from(rolesTable)
        .limit(1);
      return roles.length > 0;
    },

    /**
     * 执行种子数据初始化
     */
    async seed(): Promise<void> {
      fastify.log.info('🌱 开始初始化 RBAC 数据...');

      // 1. 插入角色（忽略冲突）
      await db
        .insert(rolesTable)
        .values([...defaultRoles])
        .onConflictDoNothing({ target: rolesTable.code });
      fastify.log.info('✅ 角色初始化完成');

      // 2. 插入权限（忽略冲突）
      await db
        .insert(permissionsTable)
        .values([...defaultPermissions])
        .onConflictDoNothing({ target: permissionsTable.code });
      fastify.log.info('✅ 权限初始化完成');

      // 3. 建立角色-权限关联
      await this.seedRolePermissions();
      fastify.log.info('✅ 角色-权限关联初始化完成');

      fastify.log.info('🎉 RBAC 数据初始化完成!');
    },

    /**
     * 初始化角色-权限关联
     */
    async seedRolePermissions(): Promise<void> {
      // 获取所有角色
      const roles = await db
        .select({ id: rolesTable.id, code: rolesTable.code })
        .from(rolesTable);

      // 获取所有权限
      const allPermissions = await db
        .select({ id: permissionsTable.id, code: permissionsTable.code })
        .from(permissionsTable);

      const rolePermissionValues: { roleId: number; permissionId: number }[] =
        [];

      for (const role of roles) {
        const permissionCodes = rolePermissionMapping[role.code];
        if (!permissionCodes || permissionCodes.length === 0) continue;

        let permissionsToAssign: { id: number; code: string }[];

        if (permissionCodes.includes('*')) {
          // 通配符：分配所有权限
          permissionsToAssign = allPermissions;
        } else {
          // 分配指定权限
          permissionsToAssign = allPermissions.filter(p =>
            permissionCodes.includes(p.code)
          );
        }

        for (const permission of permissionsToAssign) {
          rolePermissionValues.push({
            roleId: role.id,
            permissionId: permission.id
          });
        }
      }

      if (rolePermissionValues.length > 0) {
        await db
          .insert(rolePermissionsTable)
          .values(rolePermissionValues)
          .onConflictDoNothing();
      }
    }
  };
};

export default fp(
  async (fastify: FastifyInstance) => {
    const seeder = createRbacSeeder(fastify);
    fastify.decorate('rbacSeeder', seeder);

    const isSeeded = await seeder.isSeeded();
    if (!isSeeded) {
      fastify.log.info('检测到 RBAC 数据为空，自动执行初始化...');
      await seeder.seed();
    }
  },
  {
    name: 'rbac-seeder',
    dependencies: ['db']
  }
);
