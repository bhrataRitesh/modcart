import { FastifyRequest, FastifyReply } from 'fastify';

export interface UserPayload {
  id: string;
  email: string;
  role: 'ADMIN' | 'VENDOR' | 'CUSTOMER' | 'SUPERADMIN';
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
