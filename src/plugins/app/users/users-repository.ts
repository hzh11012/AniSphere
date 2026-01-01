import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { eq, sql } from 'drizzle-orm';
import { usersTable } from '../../../db/index.js';
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
     * 查找或注册用户
     * - 如果用户存在，直接返回
     * - 如果用户不存在，注册新用户并分配角色
     */
    async findOrCreate(email: string, name?: string) {
      const userName = name ?? this.generateDefaultName();

      return toResult(
        db
          .insert(usersTable)
          .values({ email, name: userName })
          .onConflictDoUpdate({
            target: usersTable.email,
            set: {
              updatedAt: sql`now()`
            }
          })
          .returning()
          .then(users => users[0])
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
