import { FastifyInstance } from 'fastify';
import { prisma } from '@modcart/db';
import { hashPassword } from '@modcart/core';

export default async function adminRoutes(fastify: FastifyInstance) {
  // Authentication & Role Check
  fastify.addHook('preHandler', (fastify as any).authenticate);
  fastify.addHook('preHandler', async (request, reply) => {
    const userArr = request.user as any;
    if (userArr.role !== 'ADMIN' && userArr.role !== 'SUPERADMIN') {
      return reply.code(403).send({ message: 'Forbidden: Admin access required' });
    }
  });

  // TEST IMPERSONATE with GET
  fastify.get('/impersonate/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.code(404).send({ message: 'Target User not found' });
    const token = fastify.jwt.sign({ id: user.id, email: user.email, role: user.role });
    return { token, user: { id: user.id, email: user.email, role: user.role } };
  });

  // 1. Stats
  fastify.get('/stats', async () => {
    const [gmv, orders, vendors, products, customers] = await Promise.all([
      prisma.order.aggregate({ where: { paymentStatus: 'PAID' }, _sum: { total: true } }),
      prisma.order.count(),
      prisma.vendorProfile.count(),
      prisma.product.count(),
      prisma.user.count({ where: { role: 'CUSTOMER' } })
    ]);
    return { gmv: gmv._sum.total || 0, orders, vendors, products, customers, platformFee: (gmv._sum.total || 0) * 0.1 };
  });

  // 2. Users
  fastify.get('/users', async () => {
    return prisma.user.findMany({
      select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });
  });

  // 3. Vendors
  fastify.get('/vendors', async () => {
    return prisma.vendorProfile.findMany({
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } }, _count: { select: { products: true } } },
      orderBy: { createdAt: 'desc' }
    });
  });

  fastify.put('/vendors/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as any;
    return prisma.vendorProfile.update({ where: { id }, data: { status } });
  });

  fastify.post('/vendors', async (request, reply) => {
    const { email, password, firstName, lastName, storeName } = request.body as any;
    
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return reply.code(400).send({ message: 'User already exists' });

    const hashedPassword = await hashPassword(password);
    
    return prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        firstName,
        lastName,
        role: 'VENDOR',
        vendorProfile: {
          create: {
            storeName,
            storeSlug: storeName.toLowerCase().replace(/[^a-z0-0]/g, '-'),
            status: 'ACTIVE'
          }
        }
      }
    });
  });

  fastify.post('/users', async (request, reply) => {
    const { email, password, firstName, lastName, role } = request.body as any;
    
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return reply.code(400).send({ message: 'User already exists' });

    const hashedPassword = await hashPassword(password);
    
    return prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        firstName,
        lastName,
        role: role || 'CUSTOMER',
        status: 'ACTIVE'
      }
    });
  });

  // 4. Products
  fastify.get('/products', async () => {
    return prisma.product.findMany({
      include: { vendor: { select: { storeName: true } }, _count: { select: { reviews: true } } },
      orderBy: { createdAt: 'desc' }
    });
  });

  // 5. Orders
  fastify.get('/orders', async () => {
    return prisma.order.findMany({
      include: { user: { select: { email: true, firstName: true, lastName: true } }, vendorOrders: { include: { vendor: { select: { storeName: true } } } } },
      orderBy: { createdAt: 'desc' }
    });
  });

  // 6. Payouts
  fastify.get('/payouts', async () => {
    return prisma.payout.findMany({
      include: { vendor: { select: { storeName: true, user: { select: { email: true } } } } },
      orderBy: { createdAt: 'desc' }
    });
  });

  fastify.put('/payouts/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as any;
    return prisma.payout.update({ where: { id }, data: { status } });
  });

  // 7. Reviews
  fastify.get('/reviews', async () => {
    return prisma.review.findMany({
      include: { product: { select: { name: true } }, user: { select: { email: true, firstName: true } } },
      orderBy: { createdAt: 'desc' }
    });
  });

  fastify.delete('/reviews/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    return prisma.review.delete({ where: { id } });
  });
}
