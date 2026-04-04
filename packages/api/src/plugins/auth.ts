import { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

const authPlugin: FastifyPluginCallback = (fastify, opts, done) => {
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  done();
};

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(authPlugin);
