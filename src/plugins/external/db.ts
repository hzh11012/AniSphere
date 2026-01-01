import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import * as schema from '../../db/index.js';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg, { type Pool } from 'pg';

declare module 'fastify' {
  export interface FastifyInstance {
    db: NodePgDatabase<typeof schema> & { $client: Pool };
  }
}

/**
 * Database plugin using Drizzle ORM with PostgreSQL.
 * Pool configuration is read from environment variables.
 *
 * @see {@link https://orm.drizzle.team/docs/get-started-postgresql}
 */
const dbPlugin = async (fastify: FastifyInstance) => {
  if (fastify.hasDecorator('db')) {
    throw new Error(
      'A `db` decorator is already registered—please avoid registering it more than once.'
    );
  }

  const pool = new pg.Pool({
    connectionString: fastify.config.DATABASE_URL,
    max: fastify.config.DB_POOL_MAX,
    idleTimeoutMillis: fastify.config.DB_POOL_IDLE_TIMEOUT,
    connectionTimeoutMillis: fastify.config.DB_POOL_CONNECTION_TIMEOUT
  });

  const drizzleClient = drizzle({
    client: pool,
    schema
  });

  fastify.decorate('db', drizzleClient);

  fastify.addHook('onClose', async instance => {
    fastify.log.info('Closing database connection pool...');
    await instance.db.$client.end();
    fastify.log.info('Database connection pool closed');
  });
};

export default fp(dbPlugin, {
  name: 'db',
  dependencies: ['@fastify/env']
});
