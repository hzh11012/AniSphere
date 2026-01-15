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
      SESSION_DOMAIN: string;
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
      // qBittorrent
      QBIT_HOST: string;
      QBIT_USERNAME: string;
      QBIT_PASSWORD: string;
      QBIT_DOWNLOAD_PATH: string;
      // ffmpeg
      FFMPEG_PATH: string;
      FFMPEG_THREADS: number;
      FFMPEG_HLS_SEGMENT_TIME: number;
      FFMPEG_TRANSCODE_OUTPUT_PATH: string;
    };
  }
}

const schema = {
  type: 'object',
  required: [
    'DATABASE_URL',
    'ADMIN_EMAIL',
    'REDIS_URL',
    'SESSION_DOMAIN',
    'SESSION_SECRET',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS',
    'SMTP_FROM',
    'CORS_ORIGINS',
    'QBIT_HOST',
    'QBIT_USERNAME',
    'QBIT_PASSWORD',
    'QBIT_DOWNLOAD_PATH',
    'FFMPEG_TRANSCODE_OUTPUT_PATH'
  ],
  properties: {
    // Environment
    NODE_ENV: { type: 'string', default: 'development' },
    PORT: { type: 'number', default: 3000 },
    // Admin
    ADMIN_EMAIL: { type: 'string' },
    // Database
    DATABASE_URL: { type: 'string' },
    DB_POOL_MAX: { type: 'number', default: 20 },
    DB_POOL_IDLE_TIMEOUT: { type: 'number', default: 30000 },
    DB_POOL_CONNECTION_TIMEOUT: { type: 'number', default: 2000 },
    // Redis
    REDIS_URL: { type: 'string' },
    // Session
    SESSION_DOMAIN: { type: 'string' },
    SESSION_SECRET: { type: 'string' },
    SESSION_MAX_AGE: { type: 'number', default: 604800000 },
    SESSION_RENEW_THRESHOLD: { type: 'number', default: 86400000 },
    // Security
    RATE_LIMIT_MAX: { type: 'number', default: 100 },
    CORS_ORIGINS: { type: 'string' },
    // SMTP
    SMTP_HOST: { type: 'string' },
    SMTP_PORT: { type: 'number', default: 465 },
    SMTP_SECURE: { type: 'boolean', default: true },
    SMTP_USER: { type: 'string' },
    SMTP_PASS: { type: 'string' },
    SMTP_FROM: { type: 'string' },
    // qBittorrent
    QBIT_HOST: { type: 'string' },
    QBIT_USERNAME: { type: 'string' },
    QBIT_PASSWORD: { type: 'string' },
    QBIT_DOWNLOAD_PATH: { type: 'string' },
    // ffmpeg
    FFMPEG_PATH: { type: 'string', default: 'ffmpeg' },
    FFMPEG_THREADS: { type: 'number', default: 4 },
    FFMPEG_HLS_SEGMENT_TIME: { type: 'number', default: 10 },
    FFMPEG_TRANSCODE_OUTPUT_PATH: { type: 'string' }
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
