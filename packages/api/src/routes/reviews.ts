import { FastifyInstance } from 'fastify';
import { prisma } from '@modcart/db';
import { validate } from '../middleware/validate';
import { createReviewSchema } from '../schemas/review.schema';
import { requireRole } from '../middleware/rbac';
import { UserPayload } from '../types';
import { z } from 'zod';

type CreateReviewBody = z.infer<typeof createReviewSchema>;

export default async function reviewRoutes(fastify: FastifyInstance) {
  // Get reviews for a product
  fastify.get('/:productId', async (request) => {
    const { productId } = (request.params as { productId: string });
    return prisma.review.findMany({
      where: { productId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  // Submit a review
  fastify.post('/', { preHandler: [fastify.authenticate, validate(createReviewSchema)] }, async (request, reply) => {
    const body = request.body as CreateReviewBody;
    const userJwt = request.user as UserPayload;

    // Check if user already reviewed this product
    const existing = await prisma.review.findFirst({
      where: {
        productId: body.productId,
        userId: userJwt.id,
      },
    });

    if (existing) {
      return reply.code(400).send({ message: 'You have already reviewed this product' });
    }

    const review = await prisma.review.create({
      data: {
        productId: body.productId,
        userId: userJwt.id,
        rating: body.rating,
        comment: body.comment,
      },
    });

    return review;
  });

  // Admin: Delete a review (Moderation)
  fastify.delete('/:id', { preHandler: [fastify.authenticate, requireRole(['ADMIN', 'SUPERADMIN'])] }, async (request, reply) => {
    const { id } = (request.params as { id: string });

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
