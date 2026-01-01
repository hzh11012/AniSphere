import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { eq, sql } from 'drizzle-orm';
import { usersTable } from '../../../db/schema.js';

declare module 'fastify' {
  interface FastifyInstance {
    adminSeeder: {
      seed: () => Promise<void>;
      isAdminExists: () => Promise<boolean>;
    };
  }
}

const createAdminSeeder = (fastify: FastifyInstance) => {
  const { db, config } = fastify;

  return {
    /**
     * 检查是否已存在管理员
     */
    async isAdminExists(): Promise<boolean> {
      const result = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(usersTable)
        .where(eq(usersTable.role, 'admin'));

      return (result[0]?.count ?? 0) > 0;
    },

    /**
     * 创建管理员账户
     */
    async seed(): Promise<void> {
      const adminEmail = config.ADMIN_EMAIL?.trim();

      if (!adminEmail) {
        throw new Error('未配置 ADMIN_EMAIL');
      }

      fastify.log.info(`🔐 开始创建管理员账户: ${adminEmail}`);

      await db.transaction(async tx => {
        // 创建或获取用户
        const [user] = await tx
          .insert(usersTable)
          .values({
            email: adminEmail,
            name: '默认管理员',
            role: 'admin'
          })
          .onConflictDoUpdate({
            target: usersTable.email,
            set: { role: 'admin', updatedAt: sql`now()` }
          })
          .returning();

        if (!user) {
          throw new Error('创建管理员用户失败');
        }

        fastify.log.info(
          `✅ 管理员账户创建成功: ${adminEmail} (ID: ${user.id})`
        );
      });
    }
  };
};

export default fp(
  async (fastify: FastifyInstance) => {
    const seeder = createAdminSeeder(fastify);
    fastify.decorate('adminSeeder', seeder);

    // 检查是否已有管理员
    const hasAdmin = await seeder.isAdminExists();
    if (!hasAdmin) {
      await seeder.seed();
    }
  },
  {
    name: 'admin-seeder',
    dependencies: ['db', '@fastify/env']
  }
);
