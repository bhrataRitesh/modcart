import { FastifyInstance } from 'fastify';
import { prisma } from '@modcart/db';

export default async function payoutRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', (fastify as any).authenticate);

  // Get payout history
  fastify.get('/', async (request) => {
    const user = request.user as { id: string };
    const vendor = await prisma.vendorProfile.findUnique({
      where: { userId: user.id },
    });

    if (!vendor) return [];

    return prisma.payout.findMany({
      where: { vendorId: vendor.id },
      orderBy: { createdAt: 'desc' },
    });
  });

  // Get earnings/payout stats
  fastify.get('/stats', async (request) => {
    const user = request.user as { id: string };
    const vendor = await prisma.vendorProfile.findUnique({
      where: { userId: user.id },
    });

    if (!vendor) return { pending: 0, processed: 0 };

    const vendorOrders = await prisma.vendorOrder.findMany({
      where: { 
        vendorId: vendor.id,
        payoutId: null, // Orders not yet paid out
      },
    });

    const pendingEarnings = vendorOrders.reduce((sum, order) => sum + order.vendorEarnings, 0);

    const processedPayouts = await prisma.payout.aggregate({
      where: { 
        vendorId: vendor.id, 
        status: 'COMPLETED' 
      },
      _sum: { amount: true },
    });

    return {
      pending: pendingEarnings,
      processed: processedPayouts._sum.amount || 0,
    };
  });

  // Request a payout
  fastify.post('/request', async (request, reply) => {
    const user = request.user as { id: string };
    const vendor = await prisma.vendorProfile.findUnique({
      where: { userId: user.id },
    });

    if (!vendor) {
      return reply.code(403).send({ message: 'Vendor profile not found' });
    }

    // Find all orders that haven't been paid out yet
    const unpaidOrders = await prisma.vendorOrder.findMany({
      where: { 
        vendorId: vendor.id,
        payoutId: null,
        // In a real system, we'd check if the order status is DELIVERED and past return window
      },
    });

    const totalAmount = unpaidOrders.reduce((sum, order) => sum + order.vendorEarnings, 0);

    if (totalAmount <= 0) {
      return reply.code(400).send({ message: 'No pending earnings to payout' });
    }

    // Create payout record
    const payout = await prisma.payout.create({
      data: {
        vendorId: vendor.id,
        amount: totalAmount,
        currency: 'USD', // Default
        status: 'PENDING',
        provider: 'STRIPE', // Placeholder
        vendorOrders: {
          connect: unpaidOrders.map(o => ({ id: o.id })),
        },
      },
    });

    return payout;
  });
}
