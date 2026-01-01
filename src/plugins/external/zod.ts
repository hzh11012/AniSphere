import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zhCN } from 'zod/locales';
import fp from 'fastify-plugin';
import {
  serializerCompiler,
  validatorCompiler
} from 'fastify-type-provider-zod';

z.config(zhCN());

const zodPlugin = async (fastify: FastifyInstance) => {
  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);
};

export default fp(zodPlugin, {
  name: 'zod'
});
