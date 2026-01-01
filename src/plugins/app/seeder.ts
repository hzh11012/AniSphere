import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { eq, sql } from 'drizzle-orm';
import { tagsTable, usersTable } from '../../db/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    seeder: { seed: () => Promise<void> };
  }
}

const defaultTags = [
  '原创',
  '漫画改',
  '小说改',
  '游戏改',
  '特摄',
  '热血',
  '穿越',
  '奇幻',
  '战斗',
  '玄幻',
  '搞笑',
  '日常',
  '科幻',
  '武侠',
  '萌系',
  '治愈',
  '校园',
  '少儿',
  '泡面',
  '悬疑',
  '恋爱',
  '少女',
  '魔法',
  '冒险',
  '历史',
  '架空',
  '机战',
  '神魔',
  '声控',
  '运动',
  '励志',
  '音乐',
  '推理',
  '社团',
  '智斗',
  '催泪',
  '美食',
  '偶像',
  '乙女',
  '职场',
  '古风',
  '工口'
] as const;

const createSeeder = (fastify: FastifyInstance) => {
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
    async seedAdmin(): Promise<void> {
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
    },

    /**
     * 检查是否已存在分类
     */
    async isTagExists(): Promise<boolean> {
      const result = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(tagsTable);

      return (result[0]?.count ?? 0) > 0;
    },

    /**
     * 创建默认分类
     */
    async seedTags(): Promise<void> {
      fastify.log.info('🏷️ 开始创建默认分类...');
      const tags = defaultTags.map(name => ({ name }));

      await db.transaction(async tx => {
        await tx
          .insert(tagsTable)
          .values(tags)
          .onConflictDoNothing({ target: tagsTable.name });

        fastify.log.info(
          `✅ 默认分类创建成功，共 ${defaultTags.length} 个分类`
        );
      });
    },

    /**
     * 初始化应用
     */
    async seed(): Promise<void> {
      // 创建管理员账户
      const hasAdmin = await this.isAdminExists();
      if (!hasAdmin) await this.seedAdmin();

      // 创建默认分类
      const hasTags = await this.isTagExists();
      if (!hasTags) await this.seedTags();
    }
  };
};

export default fp(
  async (fastify: FastifyInstance) => {
    const seeder = createSeeder(fastify);
    fastify.decorate('seeder', seeder);
  },
  {
    name: 'seeder',
    dependencies: ['db', '@fastify/env']
  }
);
