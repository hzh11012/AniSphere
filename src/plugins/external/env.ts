import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import env from '@fastify/env';

declare module 'fastify' {
  export interface FastifyInstance {
    config: {
      NODE_ENV: string;
      PORT: number;
      DATABASE_URL: string;
      ADMIN_EMAIL: string;
      RATE_LIMIT_MAX: number;
      CORS_ORIGINS: string;
      // Database pool configuration
      DB_POOL_MAX: number;
      DB_POOL_IDLE_TIMEOUT: number;
      DB_POOL_CONNECTION_TIMEOUT: number;
      // Redis
      REDIS_URL: string;
      // Session
      SESSION_SECRET: string;
      SESSION_MAX_AGE: number;
      SESSION_RENEW_THRESHOLD: number;
      // SMTP
      SMTP_HOST: string;
      SMTP_PORT: number;
      SMTP_SECURE: boolean;
      SMTP_USER: string;
      SMTP_PASS: string;
      SMTP_FROM: string;
    };
  }
}

const schema = {
  type: 'object',
  required: [
    'DATABASE_URL',
    'ADMIN_EMAIL',
    'REDIS_URL',
    'SESSION_SECRET',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS',
    'SMTP_FROM',
    'CORS_ORIGINS'
  ],
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

    // Admin
    ADMIN_EMAIL: {
      type: 'string'
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

    // Redis
    REDIS_URL: {
      type: 'string'
    },

    // Session
    SESSION_SECRET: {
      type: 'string'
    },
    SESSION_MAX_AGE: {
      type: 'number',
      default: 604800000 // 7天
    },
    SESSION_RENEW_THRESHOLD: {
      type: 'number',
      default: 86400000 // 1天
    },

    // Security
    RATE_LIMIT_MAX: {
      type: 'number',
      default: 100
    },
    CORS_ORIGINS: {
      type: 'string'
    },

    // SMTP
    SMTP_HOST: {
      type: 'string'
    },
    SMTP_PORT: {
      type: 'number',
      default: 465
    },
    SMTP_SECURE: {
      type: 'boolean',
      default: true
    },
    SMTP_USER: {
      type: 'string'
    },
    SMTP_PASS: {
      type: 'string'
    },
    SMTP_FROM: {
      type: 'string'
    }
  }
};

/**
 * This plugins helps to check environment variables.
 *
 * @see {@link https://github.com/fastify/fastify-env}
 */
const envPlugin = async (fastify: FastifyInstance) => {
  await fastify.register(env, {
    schema,
    dotenv: true
  });
};

export default fp(envPlugin, {
  name: '@fastify/env'
});
