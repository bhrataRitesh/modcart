import { FastifyInstance } from 'fastify';
import { prisma } from '@modcart/db';
import { validate } from '../middleware/validate';
import { createReviewSchema } from '../schemas/review.schema';
import { requireRole } from '../middleware/rbac';
import { UserPayload } from '../types';
import { z } from 'zod';

type CreateReviewBody = z.infer<typeof createReviewSchema>;

export default async function reviewRoutes(fastify: FastifyInstance) {
  // Get reviews for a product with stats
  fastify.get('/:productId', async (request) => {
    const { productId } = (request.params as { productId: string });
    const reviews = await prisma.review.findMany({
      where: { productId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: { createdAt: 'desc' },
    });

    const total = reviews.length;
    const avgRating = total > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / total
      : 0;

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach(r => { distribution[r.rating] = (distribution[r.rating] || 0) + 1; });

    return { reviews, total, avgRating: Math.round(avgRating * 10) / 10, distribution };
  });

  // Submit a review (with verified purchase check)
  fastify.post('/', { preHandler: [fastify.authenticate, validate(createReviewSchema)] }, async (request, reply) => {
    const body = request.body as CreateReviewBody;
    const userJwt = request.user as UserPayload;

    const existing = await prisma.review.findFirst({
      where: { productId: body.productId, userId: userJwt.id },
    });
    if (existing) return reply.code(400).send({ message: 'You have already reviewed this product' });

    // Check for verified purchase
    const verifiedPurchase = await prisma.orderItem.findFirst({
      where: {
        productId: body.productId,
        order: { userId: userJwt.id, paymentStatus: 'PAID' }
      }
    });

    const review = await prisma.review.create({
      data: {
        productId: body.productId,
        userId: userJwt.id,
        rating: body.rating,
        comment: body.comment,
        isVerified: !!verifiedPurchase,
      },
    });

    return review;
  });

  // Admin: Delete a review
  fastify.delete('/:id', { preHandler: [fastify.authenticate, requireRole(['ADMIN', 'SUPERADMIN'])] }, async (request, reply) => {
    const { id } = (request.params as { id: string });
    try {
      await prisma.review.delete({ where: { id } });
      return { message: 'Review successfully removed' };
    } catch (error) {
      return reply.code(404).send({ message: 'Review not found' });
    }
  });
}
