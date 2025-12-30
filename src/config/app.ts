import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyServerOptions
} from 'fastify';
import { join } from 'node:path';
import AutoLoad, { type AutoloadPluginOptions } from '@fastify/autoload';
import type { LoggerOptions } from 'pino';
import { randomUUID } from 'node:crypto';

interface AppOptions
  extends FastifyServerOptions, Partial<AutoloadPluginOptions> {}

const isDev = process.env.NODE_ENV !== 'production';

// 根据环境配置日志
const getLoggerConfig = (): LoggerOptions | boolean => {
  if (isDev) {
    // 开发环境：使用 pino-pretty，输出到控制台
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

  // 生产环境：输出到 stdout
  return { level: 'info' };
};

const options: AppOptions = {
  logger: getLoggerConfig(),
  genReqId: () => randomUUID()
};

const buildApp = async (
  opts: AppOptions = options
): Promise<FastifyInstance> => {
  const fastify = Fastify(opts);

  // 加载第三方库
  await fastify.register(AutoLoad, {
    dir: join(import.meta.dirname, '../core/external'),
    options: { ...opts }
  });

  // 加载应用库
  await fastify.register(AutoLoad, {
    dir: join(import.meta.dirname, '../core/app'),
    ignoreFilter(path) {
      return /plugins\/plugin-(?!service(?:\.|\/|$))[\w-]+/.test(path);
    },
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

      return reply.notFound('Not Found');
    }
  );

  return fastify;
};

export { options, buildApp };
