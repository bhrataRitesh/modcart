import { FastifyReply, FastifyRequest } from 'fastify';
import { ZodSchema, ZodError } from 'zod';

export const validate = (schema: ZodSchema) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      request.body = schema.parse(request.body);
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          message: 'Validation failed',
          errors: error.errors
        });
      }
      return reply.code(500).send({ message: 'Internal validation error' });
    }
  };
};
