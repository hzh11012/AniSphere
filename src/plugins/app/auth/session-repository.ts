import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { randomBytes } from 'node:crypto';
import { err, toResult } from '../../../utils/result.js';

export interface SessionData {
  userId: number;
  email: string;
  roles: string[];
  permissions: string[];
  status: boolean;
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
     * 生成 session token
     */
    generateToken(): string {
      return randomBytes(32).toString('hex');
    },

    /**
     * 构建 Redis key
     */
    buildKey(token: string): string {
      return `${SESSION_PREFIX}${token}`;
    },

    /**
     * 构建用户 session 索引 key
     */
    buildUserIndexKey(userId: number): string {
      return `user_sessions:${userId}`;
    },

    /**
     * 验证 token 格式是否有效
     */
    isValidToken(token: string | undefined | null) {
      return (
        typeof token === 'string' &&
        token.length === 64 &&
        /^[a-f0-9]+$/.test(token)
      );
    },

    /**
     * 创建 session
     */
    async createSession(
      userId: number,
      email: string,
      roles: string[],
      permissions: string[],
      status: boolean
    ) {
      const token = this.generateToken();
      const now = Date.now();

      const sessionData: SessionData = {
        userId,
        email,
        roles,
        permissions,
        status,
        createdAt: now,
        lastAccessAt: now
      };

      const maxAgeSeconds = Math.floor(config.SESSION_MAX_AGE / 1000);
      const key = this.buildKey(token);
      const userIndexKey = this.buildUserIndexKey(userId);

      return toResult(
        (async () => {
          const pipeline = redis.pipeline();
          pipeline.setex(key, maxAgeSeconds, JSON.stringify(sessionData));
          pipeline.sadd(userIndexKey, token);
          pipeline.expire(userIndexKey, maxAgeSeconds);
          await pipeline.exec();
          return token;
        })()
      );
    },

    /**
     * 获取 session
     */
    async getSession(token: string) {
      if (!this.isValidToken(token)) {
        return err(new Error('Invalid token'));
      }

      const key = this.buildKey(token);

      return toResult(
        redis.get(key).then(data => {
          if (!data) return null;
          return JSON.parse(data) as SessionData;
        })
      );
    },

    /**
     * 更新 session（续签）
     */
    async renewSession(token: string, sessionData: SessionData) {
      if (!this.isValidToken(token)) {
        return err(new Error('Invalid token'));
      }

      const maxAgeSeconds = Math.floor(config.SESSION_MAX_AGE / 1000);
      sessionData.lastAccessAt = Date.now();
      const key = this.buildKey(token);
      // 同时更新用户索引的过期时间
      const userIndexKey = this.buildUserIndexKey(sessionData.userId);

      return toResult(
        (async () => {
          const pipeline = redis.pipeline();
          pipeline.setex(key, maxAgeSeconds, JSON.stringify(sessionData));
          pipeline.expire(userIndexKey, maxAgeSeconds);
          await pipeline.exec();
        })()
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
     * 删除 session
     */
    async deleteSession(token: string) {
      if (!this.isValidToken(token)) {
        return err(new Error('Invalid token'));
      }

      // 先获取 session 以获取 userId
      const sessionResult = await this.getSession(token);
      const key = this.buildKey(token);

      return toResult(
        (async () => {
          const pipeline = redis.pipeline();
          // 删除 session
          pipeline.del(key);

          // 如果能获取到 session，从用户索引中移除
          if (sessionResult.isOk() && sessionResult.value) {
            const userIndexKey = this.buildUserIndexKey(
              sessionResult.value.userId
            );
            pipeline.srem(userIndexKey, token);
          }

          await pipeline.exec();
        })()
      );
    },

    /**
     * 删除用户所有 session
     */
    async deleteAllUserSessions(userId: number) {
      const userIndexKey = this.buildUserIndexKey(userId);

      return toResult(
        (async () => {
          // 获取用户所有的 session token
          const tokens = await redis.smembers(userIndexKey);

          if (tokens.length > 0) {
            // 批量删除所有 session
            const keys = tokens.map(t => this.buildKey(t));
            await redis.del(...keys);
          }

          // 删除用户索引
          await redis.del(userIndexKey);
        })()
      );
    },

    /**
     * 批量更新用户所有 session
     */
    async batchUpdateUserSessions(
      userId: number,
      updater: (session: SessionData) => void
    ) {
      const userIndexKey = this.buildUserIndexKey(userId);
      const tokens = await redis.smembers(userIndexKey);
      if (tokens.length === 0) return;

      // 批量获取
      const getPipeline = redis.pipeline();
      for (const token of tokens) {
        const key = this.buildKey(token);
        getPipeline.get(key);
        getPipeline.ttl(key);
      }
      const results = await getPipeline.exec();
      if (!results) return;

      // 批量更新
      const updatePipeline = redis.pipeline();
      const expiredTokens: string[] = [];

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const data = results[i * 2]?.[1] as string | null;
        const ttl = results[i * 2 + 1]?.[1] as number;

        if (data && ttl > 0) {
          const session = JSON.parse(data) as SessionData;
          updater(session); // 应用更新逻辑
          updatePipeline.setex(
            this.buildKey(token),
            ttl,
            JSON.stringify(session)
          );
        } else if (!data) {
          expiredTokens.push(token);
        }
      }

      if (expiredTokens.length > 0) {
        updatePipeline.srem(userIndexKey, ...expiredTokens);
      }

      await updatePipeline.exec();
    },

    /**
     * 刷新用户所有 session 的权限
     */
    async refreshUserSessionsPermissions(
      userId: number,
      roles: string[],
      permissions: string[]
    ) {
      return toResult(
        this.batchUpdateUserSessions(userId, session => {
          session.roles = roles;
          session.permissions = permissions;
          session.lastAccessAt = Date.now();
        })
      );
    },

    /**
     * 刷新用户所有 session 的状态
     */
    async refreshUserSessionsStatus(userId: number, status: boolean) {
      return toResult(
        this.batchUpdateUserSessions(userId, session => {
          session.status = status;
        })
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
        signed: true,
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
