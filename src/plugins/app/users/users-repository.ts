import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { eq } from 'drizzle-orm';
import { usersTable } from '../../../db/schema.js';
import { toResult } from '../../../utils/result.js';

declare module 'fastify' {
  interface FastifyInstance {
    usersRepository: ReturnType<typeof createUsersRepository>;
  }
}

const createUsersRepository = (fastify: FastifyInstance) => {
  const db = fastify.db;

  return {
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

    async create(data: { email: string; name: string }) {
      const now = Math.floor(Date.now() / 1000);

      return toResult(
        db
          .insert(usersTable)
          .values({
            email: data.email,
            name: data.name,
            createdAt: now,
            updatedAt: now
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
