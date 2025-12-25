import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyServerOptions
} from 'fastify';
import AutoLoad, { type AutoloadPluginOptions } from '@fastify/autoload';
import type { LoggerOptions } from 'pino';

interface AppOptions
  extends FastifyServerOptions, Partial<AutoloadPluginOptions> {}

const ROOT_DIR = join(import.meta.dirname, '../..');
const LOGS_DIR = join(ROOT_DIR, 'logs');
const isDev = process.env.NODE_ENV !== 'production';

// 生产环境确保日志目录存在
if (!isDev) {
  mkdirSync(LOGS_DIR, { recursive: true });
}

// 根据环境配置日志
const getLoggerConfig = (): LoggerOptions | boolean => {
  if (isDev) {
    // 开发环境：只使用 pino-pretty，输出到控制台
    return {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname'
        }
      },
      level: 'debug'
    };
  }

  // 生产环境：使用多个 transport targets
  return {
    transport: {
      targets: [
        {
          target: 'pino/file',
          options: { destination: join(LOGS_DIR, 'info.log') },
          level: 'info'
        },
        {
          target: 'pino/file',
          options: { destination: join(LOGS_DIR, 'warn.log') },
          level: 'warn'
        },
        {
          target: 'pino/file',
          options: { destination: join(LOGS_DIR, 'error.log') },
          level: 'error'
        }
      ]
    },
    level: 'info'
  };
};

const options: AppOptions = {
  logger: getLoggerConfig()
};

const buildApp = async (
  opts: AppOptions = options
): Promise<FastifyInstance> => {
  const fastify = Fastify(opts);

  // 加载外部插件
  await fastify.register(AutoLoad, {
    dir: join(import.meta.dirname, '../plugins/external'),
    options: { ...opts }
  });

  // 加载应用插件
  await fastify.register(AutoLoad, {
    dir: join(import.meta.dirname, '../plugins/app'),
    options: { ...opts }
  });

  // 加载路由
  await fastify.register(AutoLoad, {
    dir: join(import.meta.dirname, '../routes'),
    autoHooks: true,
    cascadeHooks: true,
    options: { ...opts }
  });

  // 全局错误处理
  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    fastify.log.error(
      {
        error,
        request: {
          method: request.method,
          url: request.url,
          query: request.query,
          params: request.params
        }
      },
      'Unhandled error occurred'
    );

    reply.code(error.statusCode ?? 500);

    return {
      message:
        error.statusCode && error.statusCode < 500
          ? error.message
          : 'Internal Server Error'
    };
  });

  // 404 处理
  fastify.setNotFoundHandler(
    {
      preHandler: fastify.rateLimit({
        max: 3,
        timeWindow: 500
      })
    },
    (request, reply) => {
      request.log.warn(
        {
          request: {
            method: request.method,
            url: request.url,
            query: request.query,
            params: request.params
          }
        },
        'Resource not found'
      );

      reply.code(404);

      return { message: 'Not Found' };
    }
  );

  return fastify;
};

export { options, buildApp };
