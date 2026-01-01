import type { FastifyInstance, FastifyError, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import sensible from '@fastify/sensible';

declare module 'fastify' {
  interface FastifyReply {
    success: <T>(message: string, data?: T) => FastifyReply;
  }
}

/**
 * This plugin adds some utilities to handle http errors.
 *
 * @see {@link https://github.com/fastify/fastify-sensible}
 */
const sensiblePlugin = async (fastify: FastifyInstance) => {
  await fastify.register(sensible);

  // 添加 reply.success() 方法
  fastify.decorateReply('success', function <
    T
  >(this: FastifyReply, message: string, data?: T) {
    return this.status(200).send({
      code: 200,
      message,
      ...(data !== undefined && { data })
    });
  });

  // 自定义错误处理器
  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    const code = error.statusCode || 500;

    reply.status(code).send({
      code,
      message: error.message
    });
  });
};

export default fp(sensiblePlugin, {
  name: 'sensible'
});
