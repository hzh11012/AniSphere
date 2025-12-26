import cookie from '@fastify/cookie';

export const autoConfig = {
  secret: process.env.SESSION_SECRET,
  parseOptions: {}
};

export default cookie;
