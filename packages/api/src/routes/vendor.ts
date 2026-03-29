import { FastifyInstance } from 'fastify';
import { prisma } from '@modcart/db';

export default async function vendorRoutes(fastify: FastifyInstance) {
  fastify.get('/stats', { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    try {
      const user = request.user as { id: string };
      
      const vendor = await prisma.vendorProfile.findUnique({
        where: { userId: user.id }
      });

      if (!vendor) {
        return reply.status(404).send({ message: 'Vendor profile not found' });
      }

      // Aggregate statistics
      const [productCount, orderCount, totalSales, reviewStats] = await Promise.all([
        prisma.product.count({ where: { vendorId: vendor.id } }),
        prisma.vendorOrder.count({ where: { vendorId: vendor.id } }),
        prisma.vendorOrder.aggregate({
          where: { vendorId: vendor.id },
          _sum: { vendorEarnings: true }
        }),
        prisma.review.aggregate({
          where: { product: { vendorId: vendor.id } },
          _avg: { rating: true },
          _count: { _all: true }
        })
      ]);

      // Get recent orders
      const recentOrders = await prisma.vendorOrder.findMany({
        where: { vendorId: vendor.id },
        take: 5,
        orderBy: { order: { createdAt: 'desc' } },
        include: {
          order: true
        }
      });

      return {
        stats: {
          totalProducts: productCount,
          totalOrders: orderCount,
          totalEarnings: totalSales._sum.vendorEarnings || 0,
          activeProducts: await prisma.product.count({ 
            where: { vendorId: vendor.id, status: 'ACTIVE' } 
          }),
          trustScore: reviewStats._avg.rating || 0,
          totalReviews: reviewStats._count._all || 0,
          isVerified: (reviewStats._avg.rating || 0) >= 4.5 && (reviewStats._count._all || 0) >= 5
        },
        recentOrders
      };
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: 'Error fetching vendor stats' });
    }
  });

  // Image upload
  fastify.post('/upload', { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ message: 'No file uploaded' });
      }

      const buffer = await data.toBuffer();
      const fileName = `${Date.now()}-${data.filename}`;
      const url = await fastify.storage.upload(fileName, buffer, data.mimetype);

      return { url };
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: 'Upload failed' });
    }
  });
}
