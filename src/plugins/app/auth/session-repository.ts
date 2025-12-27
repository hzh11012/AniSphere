import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { randomBytes } from 'node:crypto';
import { toResult } from '../../../utils/result.js';

export interface SessionData {
  userId: number;
  email: string;
  createdAt: number;
  lastAccessAt: number;
}

declare module 'fastify' {
  interface FastifyInstance {
    sessionRepository: ReturnType<typeof createSessionRepository>;
  }
}

const SESSION_PREFIX = 'session:';

const createSessionRepository = (fastify: FastifyInstance) => {
  const redis = fastify.redis;
  const config = fastify.config;

  return {
    /**
     * 生成 session ID
     */
    generateSessionId(): string {
      return randomBytes(32).toString('hex');
    },

    /**
     * 创建 session
     */
    async createSession(userId: number, email: string) {
      const sessionId = this.generateSessionId();
      const now = Date.now();

      const sessionData: SessionData = {
        userId,
        email,
        createdAt: now,
        lastAccessAt: now
      };

      const maxAgeSeconds = Math.floor(config.SESSION_MAX_AGE / 1000);

      return toResult(
        redis
          .setex(
            `${SESSION_PREFIX}${sessionId}`,
            maxAgeSeconds,
            JSON.stringify(sessionData)
          )
          .then(() => sessionId)
      );
    },

    /**
     * 获取 session
     */
    async getSession(sessionId: string) {
      return toResult(
        redis.get(`${SESSION_PREFIX}${sessionId}`).then(data => {
          if (!data) return null;
          return JSON.parse(data) as SessionData;
        })
      );
    },

    /**
     * 更新 session（续签）
     */
    async renewSession(sessionId: string, sessionData: SessionData) {
      const maxAgeSeconds = Math.floor(config.SESSION_MAX_AGE / 1000);
      sessionData.lastAccessAt = Date.now();

      return toResult(
        redis
          .setex(
            `${SESSION_PREFIX}${sessionId}`,
            maxAgeSeconds,
            JSON.stringify(sessionData)
          )
          .then(() => undefined)
      );
    },

    /**
     * 检查是否需要续签
     */
    shouldRenew(sessionData: SessionData): boolean {
      const now = Date.now();
      const timeSinceLastAccess = now - sessionData.lastAccessAt;
      return timeSinceLastAccess > config.SESSION_RENEW_THRESHOLD;
    },

    /**
     * 删除 session（登出）
     */
    async deleteSession(sessionId: string) {
      return toResult(
        redis.del(`${SESSION_PREFIX}${sessionId}`).then(() => undefined)
      );
    },

    /**
     * 删除用户所有 session（强制登出所有设备）
     */
    async deleteAllUserSessions(userId: number) {
      return toResult(
        (async () => {
          const keys = await redis.keys(`${SESSION_PREFIX}*`);
          for (const key of keys) {
            const data = await redis.get(key);
            if (data) {
              const session = JSON.parse(data) as SessionData;
              if (session.userId === userId) {
                await redis.del(key);
              }
            }
          }
        })()
      );
    },

    /**
     * 获取 cookie 配置
     */
    getCookieOptions() {
      return {
        path: '/',
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        maxAge: config.SESSION_MAX_AGE / 1000 // 秒
      };
    }
  };
};

export default fp(
  async (fastify: FastifyInstance) => {
    const repo = createSessionRepository(fastify);
    fastify.decorate('sessionRepository', repo);
  },
  {
    name: 'session-repository',
    dependencies: ['redis', '@fastify/env']
  }
);
