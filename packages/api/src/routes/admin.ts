import { FastifyInstance } from 'fastify';
import { prisma } from '@modcart/db';
import { generateSlug } from '@modcart/core';
import { indexProduct } from '@modcart/search';
import { validate } from '../middleware/validate';
import { createProductSchema, updateProductSchema } from '../schemas/product.schema';
import { requireRole } from '../middleware/rbac';
import { z } from 'zod';

type CreateProductBody = z.infer<typeof createProductSchema>;
type UpdateProductBody = z.infer<typeof updateProductSchema>;

export default async function adminRoutes(fastify: FastifyInstance) {
  // Authentication & Role Check
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', requireRole(['ADMIN', 'SUPERADMIN']));

  const syncToSearch = async (productId: string) => {
    try {
      fastify.log.info({ productId }, '🔍 Starting sync to search...');
      const p = await prisma.product.findUnique({
        where: { id: productId },
        include: { vendor: true, categories: { include: { category: true } }, images: true }
      });
      if (p) {
        const payload = {
          id: p.id,
          name: p.name,
          description: p.description,
          price: Number(p.price),
          vendorId: p.vendorId,
          vendorName: p.vendor.storeName,
          categories: p.categories.map((c: any) => c.category.name),
          imageUrl: p.images[0]?.url || null,
          imageUrls: p.images.map((img: any) => img.url),
          isVerified: true
        };
        fastify.log.info({ productId, imageCount: payload.imageUrls.length }, '🚀 Sending to search index');
        await indexProduct(payload);
        fastify.log.info({ productId }, '✅ Search sync successful');
      } else {
        fastify.log.warn({ productId }, '⚠️ Product not found for search sync');
      }
    } catch (e) {
      fastify.log.error(e, '❌ Search sync CRASHED');
    }
  };

  // 1. Stats
  fastify.get('/stats', async () => {
    const [gmv, orders, vendors, products, customers, commissionSum] = await Promise.all([
      prisma.order.aggregate({ where: { paymentStatus: 'PAID' }, _sum: { total: true } }),
      prisma.order.count(),
      prisma.vendorProfile.count(),
      prisma.product.count(),
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.vendorOrder.aggregate({ where: { order: { paymentStatus: 'PAID' } }, _sum: { commissionAmount: true } })
    ]);
    return { 
      gmv: Number(gmv._sum.total || 0), 
      orders, 
      vendors, 
      products, 
      customers, 
      platformFee: Number(commissionSum._sum.commissionAmount || 0) 
    };
  });

  // 2. Users
  fastify.get('/users', async () => {
    return prisma.user.findMany({ select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true, createdAt: true }, orderBy: { createdAt: 'desc' } });
  });

  fastify.get('/impersonate/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.code(404).send({ message: 'Not found' });
    const token = fastify.jwt.sign({ id: user.id, email: user.email, role: user.role });
    return { token, user: { id: user.id, email: user.email, role: user.role } };
  });

  // 3. Vendors
  fastify.get('/vendors', async () => {
    return prisma.vendorProfile.findMany({ include: { user: { select: { id: true, email: true, firstName: true, lastName: true } }, _count: { select: { products: true } } }, orderBy: { createdAt: 'desc' } });
  });

  // 3.1. Pending Vendors
  fastify.get('/vendors/pending', async () => {
    return prisma.vendorProfile.findMany({
      where: { status: 'PENDING' },
      include: { user: { select: { email: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' }
    });
  });

  // 3.2. Update Vendor Status (Approve/Reject)
  fastify.patch('/vendors/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: 'ACTIVE' | 'SUSPENDED' | 'REJECTED' };

    const vendor = await prisma.vendorProfile.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!vendor) return reply.code(404).send({ message: 'Vendor not found' });

    await prisma.$transaction(async (tx) => {
      // Update Vendor Status
      await tx.vendorProfile.update({
        where: { id },
        data: { status }
      });

      // If approved, update user role to VENDOR if it was CUSTOMER
      if (status === 'ACTIVE' && vendor.user.role === 'CUSTOMER') {
        await tx.user.update({
          where: { id: vendor.userId },
          data: { role: 'VENDOR' }
        });
      }
      
      // For now, if active -> change to vendor.
    });

    const { logAudit } = await import('../services/audit.service');
    await logAudit({
      request,
      action: status === 'ACTIVE' ? 'VENDOR_APPROVE' : 'VENDOR_UPDATE_STATUS',
      resource: 'VendorProfile',
      resourceId: id,
      details: { status }
    });

    if (status === 'ACTIVE') {
      const { sendNotification } = await import('../services/notification.service');
      await sendNotification({
        userId: vendor.userId,
        type: 'VENDOR_APPROVED',
        title: 'Congratulations!',
        message: `Your vendor profile for "${vendor.storeName}" has been approved. You can now start selling!`,
        link: '/'
      }).catch(err => console.error('Notification failed', err));
    }

    return { message: `Vendor ${status.toLowerCase()} Successfully` };
  });

  // 3.3. Update Vendor Commission Rate
  fastify.patch('/vendors/:id/commission', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { commissionRate } = request.body as { commissionRate: number };

    await prisma.vendorProfile.update({
      where: { id },
      data: { commissionRate }
    });

    const { logAudit } = await import('../services/audit.service');
    await logAudit({
      request,
      action: 'VENDOR_SET_COMMISSION',
      resource: 'VendorProfile',
      resourceId: id,
      details: { commissionRate }
    });

    return { message: 'Commission rate updated' };
  });

  // 4.1. Audit Logs
  fastify.get('/logs', async (request) => {
    return prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { email: true, role: true } } }
    });
  });

  // 4.2. Advanced Analytics
  fastify.get('/analytics', async (request) => {
    const [revenue, topVendors, funnel] = await Promise.all([
      prisma.order.aggregate({
        where: { paymentStatus: 'PAID' },
        _sum: { total: true }
      }),
      prisma.vendorOrder.groupBy({
        by: ['vendorId'],
        where: { order: { paymentStatus: 'PAID' } },
        _sum: { vendorEarnings: true },
        orderBy: { _sum: { vendorEarnings: 'desc' } },
        take: 5
      }),
      Promise.all([
        prisma.pageVisit.count(), // Total Visits
        prisma.cart.count(),      // Total Carts Created
        prisma.order.count({ where: { paymentStatus: 'PAID' } }) // Total Completed
      ])
    ]);

    // Fetch vendor names for ranking
    const vendorDetails = await prisma.vendorProfile.findMany({
      where: { id: { in: topVendors.map(v => v.vendorId) } },
      select: { id: true, storeName: true }
    });

    const vendorRanking = topVendors.map(v => ({
      name: vendorDetails.find(d => d.id === v.vendorId)?.storeName || 'Unknown',
      earnings: v._sum.vendorEarnings
    }));

    return {
      revenue: Number(revenue._sum.total || 0),
      funnel: {
        visits: funnel[0],
        carts: funnel[1],
        orders: funnel[2],
        conversion: funnel[0] > 0 ? Number(((funnel[2] / funnel[0]) * 100).toFixed(2)) : 0
      },
      vendorRanking
    };
  });

  // 4. Products
  fastify.get('/products', async () => {
    return prisma.product.findMany({ include: { vendor: { select: { id: true, storeName: true } }, images: true, categories: { include: { category: true } } }, orderBy: { createdAt: 'desc' } });
  });

  fastify.post('/products/:id/update', { preHandler: [validate(updateProductSchema)] }, async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as UpdateProductBody;
    
    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        price: body.price,
        stockQty: body.stockQty,
        vendorId: body.vendorId,
        images: body.images ? { deleteMany: {}, create: body.images.map((img: { url: string }) => ({ url: img.url })) } : undefined,
        categories: body.categoryIds ? { deleteMany: {}, create: body.categoryIds.map((cid: string) => ({ categoryId: cid })) } : undefined
      }
    });

    await syncToSearch(updated.id);
    return updated;
  });

  fastify.post('/products', { preHandler: [validate(createProductSchema)] }, async (request) => {
    const body = request.body as CreateProductBody;
    const slug = generateSlug(body.name);
    
    const product = await prisma.product.create({
      data: { 
        name: body.name, 
        slug, 
        description: body.description, 
        price: body.price, 
        stockQty: body.stockQty, 
        vendorId: body.vendorId as string, 
        status: 'ACTIVE', 
        categories: { create: body.categoryIds?.map((id: string) => ({ categoryId: id })) || [] }, 
        images: { create: body.images?.map((img: { url: string }) => ({ url: img.url })) || [] } 
      }
    });

    await syncToSearch(product.id);
    return product;
  });

  fastify.delete('/products/:id', async (request) => {
    const { id } = request.params as { id: string };
    
    // Find images to cleanup
    const product = await prisma.product.findUnique({
      where: { id },
      include: { images: true }
    });

    if (product) {
      for (const img of product.images) {
        try {
          // Extract fileName from URL, e.g., "http://localhost:9000/modcart-images/uploads/file.jpg" -> "uploads/file.jpg"
          const parts = img.url.split('/modcart-images/');
          if (parts.length > 1) {
            await fastify.storage.delete(parts[1]);
          }
        } catch (e) {
          fastify.log.error(e, 'Failed to delete image from storage during product cleanup');
        }
      }
    }

    return prisma.product.delete({ where: { id } });
  });

  fastify.post('/upload', async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.code(400).send({ message: 'No file' });
    const buffer = await data.toBuffer();
    const fileName = `uploads/${Date.now()}-${data.filename}`;
    const url = await fastify.storage.upload(fileName, buffer, data.mimetype);
    return { url };
  });

  // 4.6. Force Re-index All
  fastify.post('/reindex', async (request, reply) => {
    try {
      const { runReindex } = await import('../scripts/reindex');
      await runReindex();
      return { message: 'Re-index complete' };
    } catch (e) {
      fastify.log.error(e);
      return reply.code(500).send({ message: 'Re-index failed', error: (e as Error).message });
    }
  });

  // 4.7. Cleanup Orphan Images
  fastify.post('/cleanup', async (request, reply) => {
    try {
      const { cleanupOrphanImages } = await import('../scripts/cleanup');
      await cleanupOrphanImages();
      return { message: 'Cleanup complete' };
    } catch (e) {
      fastify.log.error(e);
      return reply.code(500).send({ message: 'Cleanup failed' });
    }
  });

  // 5. Orders
  fastify.get('/orders', async () => {
    return prisma.order.findMany({ include: { user: { select: { email: true, firstName: true, lastName: true } }, vendorOrders: { include: { vendor: { select: { storeName: true } } } } }, orderBy: { createdAt: 'desc' } });
  });
}
