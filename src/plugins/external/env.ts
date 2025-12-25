import env from '@fastify/env';

declare module 'fastify' {
  export interface FastifyInstance {
    config: {
      NODE_ENV: string;
      PORT: number;
      DATABASE_URL: string;
      RATE_LIMIT_MAX: number;
      CORS_ORIGINS: string;
      // Database pool configuration
      DB_POOL_MAX: number;
      DB_POOL_IDLE_TIMEOUT: number;
      DB_POOL_CONNECTION_TIMEOUT: number;
    };
  }
}

const schema = {
  type: 'object',
  required: ['DATABASE_URL'],
  properties: {
    // Environment
    NODE_ENV: {
      type: 'string',
      default: 'development'
    },
    PORT: {
      type: 'number',
      default: 3000
    },

    // Database
    DATABASE_URL: {
      type: 'string'
    },
    DB_POOL_MAX: {
      type: 'number',
      default: 20
    },
    DB_POOL_IDLE_TIMEOUT: {
      type: 'number',
      default: 30000
    },
    DB_POOL_CONNECTION_TIMEOUT: {
      type: 'number',
      default: 2000
    },

    // Security
    RATE_LIMIT_MAX: {
      type: 'number',
      default: 100
    },
    CORS_ORIGINS: {
      type: 'string',
      default: ''
    }
  }
};

export const autoConfig = {
  schema,
  dotenv: true
};

/**
 * This plugins helps to check environment variables.
 *
 * @see {@link https://github.com/fastify/fastify-env}
 */
export default env;
