import { FastifyInstance } from 'fastify';
import { prisma } from '@modcart/db';

export default async function wishlistRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', async (request) => {
    const userId = (request.user as any).id;
    return prisma.wishlistItem.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            images: { take: 1 },
            vendor: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  });

  fastify.post('/:productId', async (request, reply) => {
    const userId = (request.user as any).id;
    const { productId } = request.params as { productId: string };

    const existing = await prisma.wishlistItem.findFirst({
      where: { userId, productId }
    });

    if (existing) {
      return reply.code(400).send({ message: 'Item already in wishlist' });
    }

    const item = await prisma.wishlistItem.create({
      data: { userId, productId }
    });

    return item;
  });

  fastify.delete('/:productId', async (request) => {
    const userId = (request.user as any).id;
    const { productId } = request.params as { productId: string };

    await prisma.wishlistItem.deleteMany({
      where: { userId, productId }
    });

    return { success: true };
  });

  // Social Urgency Signal
  fastify.get('/urgency/:productId', async (request) => {
    const { productId } = request.params as { productId: string };
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const viewerCount = await prisma.pageVisit.count({
      where: {
        productId,
        createdAt: { gte: oneHourAgo }
      }
    });

    // Mock "people bought this" for real urgency
    const shopperCount = await prisma.orderItem.count({
      where: {
        productId,
        order: {
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      }
    });

    return {
      recentViewers: viewerCount,
      recentShoppers: shopperCount,
      signal: viewerCount > 10 ? `${viewerCount} people viewed this in the last hour` : 
              shopperCount > 1 ? `${shopperCount} people bought this in the last 24h` : null
    };
  });
}
