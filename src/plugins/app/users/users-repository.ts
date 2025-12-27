import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { eq, sql } from 'drizzle-orm';
import { rolesTable, userRolesTable, usersTable } from '../../../db/schema.js';
import { toResult } from '../../../utils/result.js';
import { randomInt } from 'node:crypto';

declare module 'fastify' {
  interface FastifyInstance {
    usersRepository: ReturnType<typeof createUsersRepository>;
  }
}

const createUsersRepository = (fastify: FastifyInstance) => {
  const db = fastify.db;

  return {
    /**
     * 通过 email 查找用户
     */
    async findByEmail(email: string) {
      return toResult(
        db
          .select()
          .from(usersTable)
          .where(eq(usersTable.email, email))
          .limit(1)
          .then(users => users[0] ?? null)
      );
    },

    /**
     * 通过 id 查找用户
     */
    async findById(id: number) {
      return toResult(
        db
          .select()
          .from(usersTable)
          .where(eq(usersTable.id, id))
          .limit(1)
          .then(users => users[0] ?? null)
      );
    },

    /**
     * 生成默认用户名
     */
    generateDefaultName(): string {
      return `用户${randomInt(100000, 1000000).toString()}`;
    },

    /**
     * 创建用户
     */
    async create(data: { email: string; name?: string }) {
      return toResult(
        db
          .insert(usersTable)
          .values({
            email: data.email,
            name: data.name ?? this.generateDefaultName()
          })
          .returning()
          .then(users => users[0])
      );
    },

    /**
     * 查找或注册用户（事务）
     * - 如果用户存在，直接返回
     * - 如果用户不存在，注册新用户并分配角色
     */
    async findOrCreate(email: string, name?: string) {
      const userName = name ?? this.generateDefaultName();
      const FIRST_USER_LOCK_ID = 1;

      return toResult(
        db.transaction(
          async tx => {
            // 获取 advisory lock（事务结束自动释放）
            await tx.execute(
              sql`SELECT pg_advisory_xact_lock(${FIRST_USER_LOCK_ID})`
            );

            // 检查是否是第一个用户
            const [countResult] = await tx
              .select({ count: sql<number>`count(*)::int` })
              .from(usersTable);
            const isFirstUser = (countResult?.count ?? 0) === 0;
            const roleCode = isFirstUser ? 'admin' : 'guest';

            const [user] = await tx
              .insert(usersTable)
              .values({
                email,
                name: userName
              })
              .onConflictDoUpdate({
                target: usersTable.email,
                set: {
                  // 不更新任何字段，只是为了返回已存在的记录
                  updatedAt: sql`${usersTable.updatedAt}`
                }
              })
              .returning();

            if (!user) {
              throw new Error('创建用户失败');
            }

            // 检查用户是否已有角色
            const existingRoles = await tx
              .select({ id: userRolesTable.id })
              .from(userRolesTable)
              .where(eq(userRolesTable.userId, user.id))
              .limit(1);

            // 新用户才分配角色
            if (existingRoles.length === 0) {
              const [role] = await tx
                .select({ id: rolesTable.id })
                .from(rolesTable)
                .where(eq(rolesTable.code, roleCode))
                .limit(1);

              if (!role) {
                throw new Error(
                  `角色 ${roleCode} 不存在，请先初始化 RBAC 数据`
                );
              }

              await tx.insert(userRolesTable).values({
                userId: user.id,
                roleId: role.id
              });
            }

            return user;
          },
          {
            isolationLevel: 'serializable'
          }
        )
      );
    }
  };
};

export default fp(
  async (fastify: FastifyInstance) => {
    const repo = createUsersRepository(fastify);
    fastify.decorate('usersRepository', repo);
  },
  {
    name: 'users-repository',
    dependencies: ['db']
  }
);
