import { FastifyInstance } from 'fastify';
import { prisma } from '@modcart/db';

export default async function vendorRoutes(fastify: FastifyInstance) {
  // Get vendor statistics
  fastify.get('/stats', async (request, reply) => {
    try {
      // In a real app, this would be the authenticated vendor ID
      // For now, we'll try to get it from the request or use a default seed vendor
      const user = request.user as any;
      
      // Find the vendor profile for this user
      const vendor = await prisma.vendorProfile.findFirst({
        where: user ? { userId: user.id } : {}
      });

      if (!vendor) {
        return reply.status(404).send({ message: 'Vendor profile not found' });
      }

      // Aggregate statistics
      const [productCount, orderCount, totalSales] = await Promise.all([
        prisma.product.count({ where: { vendorId: vendor.id } }),
        prisma.vendorOrder.count({ where: { vendorId: vendor.id } }),
        prisma.vendorOrder.aggregate({
          where: { vendorId: vendor.id },
          _sum: { vendorEarnings: true }
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
          })
        },
        recentOrders
      };
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: 'Error fetching vendor stats' });
    }
  });

  // Image upload
  fastify.post('/upload', async (request, reply) => {
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
