import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

const authPlugin: FastifyPluginCallback = (fastify, opts, done) => {
  fastify.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  done();
};

export default fp(authPlugin);
