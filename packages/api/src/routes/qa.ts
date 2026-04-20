import { FastifyInstance } from 'fastify';
import { prisma } from '@modcart/db';

export default async function qaRoutes(fastify: FastifyInstance) {
  // Get Q&A for a product
  fastify.get('/:productId', async (request) => {
    const { productId } = request.params as { productId: string };
    return prisma.productQA.findMany({
      where: { productId, isPublic: true },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  });

  // Ask a question
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = request.user as any;
    const { productId, question } = request.body as { productId: string; question: string };

    return prisma.productQA.create({
      data: { productId, userId: user.id, question }
    });
  });

  // Answer a question (Vendor or Admin)
  fastify.patch('/:id/answer', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as { id: string };
    const { answer } = request.body as { answer: string };

    if (!['VENDOR', 'ADMIN', 'SUPERADMIN'].includes(user.role)) {
      return reply.code(403).send({ message: 'Only vendors or admins can answer questions' });
    }

    return prisma.productQA.update({
      where: { id },
      data: { answer, answeredBy: user.id }
    });
  });
}
