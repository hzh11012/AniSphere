import { AsyncLocalStorage } from 'node:async_hooks';
import type { FastifyInstance, FastifyBaseLogger } from 'fastify';
import fp from 'fastify-plugin';

interface RequestContext {
  reqId: string;
}

// AsyncLocalStorage 实例
const requestContext = new AsyncLocalStorage<RequestContext>();

// 获取当前请求 ID
const getRequestId = (): string | undefined => requestContext.getStore()?.reqId;

const createContextualLogger = (
  logger: FastifyBaseLogger
): FastifyBaseLogger => {
  const handler: ProxyHandler<FastifyBaseLogger> = {
    get(target, prop: keyof FastifyBaseLogger) {
      const value = target[prop];
      if (
        typeof value === 'function' &&
        ['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(
          prop as string
        )
      ) {
        return (...args: unknown[]) => {
          const reqId = getRequestId();
          if (reqId && args.length > 0) {
            if (typeof args[0] === 'object' && args[0] !== null) {
              args[0] = { reqId, ...(args[0] as object) };
            } else if (typeof args[0] === 'string') {
              args.unshift({ reqId });
            }
          }
          return (value as (...args: unknown[]) => void).apply(target, args);
        };
      }
      return value;
    }
  };
  return new Proxy(logger, handler);
};

export default fp(
  async (fastify: FastifyInstance) => {
    // 包装 fastify.log
    const contextualLog = createContextualLogger(fastify.log);
    fastify.log = contextualLog;

    // 设置请求上下文 + 响应头
    fastify.addHook('onRequest', async (request, reply) => {
      requestContext.enterWith({ reqId: request.id });
      reply.header('X-Request-Id', request.id);
    });
  },
  { name: 'request-context' }
);
