import { FastifyInstance } from 'fastify';
import { prisma } from '@modcart/db';
import { z } from 'zod';

const reviewSchema = z.object({
  productId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
});

export default async function reviewRoutes(fastify: FastifyInstance) {
  // Get reviews for a product
  fastify.get('/:productId', async (request) => {
    const { productId } = request.params as { productId: string };
    return prisma.review.findMany({
      where: { productId },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
  });

  // Submit a review
  fastify.post('/', { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    const body = reviewSchema.parse(request.body);
    const user = request.user as { id: string };

    // Check if user already reviewed this product
    const existing = await prisma.review.findFirst({
      where: {
        productId: body.productId,
        userId: user.id,
      },
    });

    if (existing) {
      return reply.code(400).send({ message: 'You have already reviewed this product' });
    }

    const review = await prisma.review.create({
      data: {
        productId: body.productId,
        userId: user.id,
        rating: body.rating,
        comment: body.comment,
      },
    });

    return review;
  });

  // Admin: Delete a review (Moderation)
  fastify.delete('/:id', { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as any;

    // Only allow ADMIN or SUPERADMIN to delete reviews for moderation
    if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
      return reply.code(403).send({ message: 'Forbidden: Admin access required to moderate reviews' });
    }

    try {
      await prisma.review.delete({
        where: { id },
      });
      return { message: 'Review successfully removed' };
    } catch (error) {
      return reply.code(404).send({ message: 'Review not found' });
    }
  });
}
