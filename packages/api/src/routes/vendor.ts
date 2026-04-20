import { env } from '@modcart/config';
import Stripe from 'stripe';

const stripe = new Stripe(env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2023-10-16' as any,
});

import { FastifyInstance } from 'fastify';
import { prisma } from '@modcart/db';
import { requireRole } from '../middleware/rbac';
import { UserPayload } from '../types';
import { validate } from '../middleware/validate';
import { registerVendorSchema } from '../schemas/vendor.schema';
import { z } from 'zod';

type RegisterVendorBody = z.infer<typeof registerVendorSchema>;

export default async function vendorRoutes(fastify: FastifyInstance) {
  // Public vendor registration (must be logged in as user)
  fastify.post('/register', { preHandler: [fastify.authenticate, validate(registerVendorSchema)] }, async (request, reply) => {
    const user = request.user as UserPayload;
    const body = request.body as RegisterVendorBody;

    const existing = await prisma.vendorProfile.findFirst({
      where: { userId: user.id }
    });

    if (existing) {
      return reply.code(400).send({ message: 'Vendor profile already exists for this user' });
    }

    const nameExists = await prisma.vendorProfile.findFirst({
      where: { OR: [{ storeName: body.storeName }, { storeSlug: body.storeSlug }] }
    });

    if (nameExists) {
      return reply.code(400).send({ message: 'Store name or slug already taken' });
    }

    const vendor = await prisma.vendorProfile.create({
      data: {
        userId: user.id,
        storeName: body.storeName,
        storeSlug: body.storeSlug,
        description: body.description,
        businessEmail: body.businessEmail,
        businessPhone: body.businessPhone,
        taxId: body.taxId,
        kycDocuments: body.kycDocuments as any,
        status: 'PENDING'
      }
    });

    return vendor;
  });

  // Get current user's vendor profile
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as UserPayload;
    const profile = await prisma.vendorProfile.findUnique({
      where: { userId: user.id }
    });

    if (!profile) return reply.code(404).send({ message: 'No vendor profile' });
    return profile;
  });

  fastify.get('/public-list', async () => {
    return prisma.vendorProfile.findMany({
      where: { status: 'ACTIVE' },
      select: { storeSlug: true, createdAt: true }
    });
  });

  // Protected VENDOR routes below
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', requireRole(['VENDOR']));

  fastify.get('/stats', async (request, reply) => {
    try {
      const user = request.user as UserPayload;
      
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

      return {
        stats: {
          totalProducts: productCount,
          totalOrders: orderCount,
          totalEarnings: Number(totalSales._sum.vendorEarnings || 0),
          activeProducts: await prisma.product.count({ 
            where: { vendorId: vendor.id, status: 'ACTIVE' } 
          }),
          trustScore: reviewStats._avg.rating || 0,
          totalReviews: reviewStats._count._all || 0,
        },
        recentOrders: await prisma.vendorOrder.findMany({
          where: { vendorId: vendor.id },
          take: 5,
          orderBy: { order: { createdAt: 'desc' } },
          include: {
            order: {
              include: {
                user: {
                  select: {
                    email: true,
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          }
        })
      };
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: 'Error fetching vendor stats' });
    }
  });

  // 5. Stripe Connect Onboarding
  fastify.post('/stripe/onboard', async (request, reply) => {
    const user = request.user as UserPayload;
    const vendor = await prisma.vendorProfile.findUnique({ where: { userId: user.id } });

    if (!vendor) return reply.code(404).send({ message: 'Vendor profile not found' });

    let stripeAccountId = vendor.stripeAccountId;

    // Create account if not exists
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: vendor.businessEmail || user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      stripeAccountId = account.id;
      await prisma.vendorProfile.update({
        where: { id: vendor.id },
        data: { stripeAccountId }
      });
    }

    // Create account link
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${env.FRONTEND_URL}/vendor/onboard-refresh`,
      return_url: `${env.FRONTEND_URL}/vendor/onboard-complete`,
      type: 'account_onboarding',
    });

    return { url: accountLink.url };
  });

  // 4.1. Tracking
  fastify.post('/track-visit', async (request, reply) => {
    const { vendorId, productId, visitorId, path } = request.body as any;
    await prisma.pageVisit.create({
      data: { vendorId, productId, visitorId, path }
    });
    return { ok: true };
  });

  // 4.1. Analytics
  fastify.get('/analytics', async (request, reply) => {
    const user = request.user as UserPayload;
    const vendor = await prisma.vendorProfile.findUnique({ where: { userId: user.id } });

    if (!vendor) return reply.code(404).send({ message: 'Vendor not found' });

    const [sales, orders, visitors] = await Promise.all([
      prisma.vendorOrder.aggregate({
        where: { vendorId: vendor.id, order: { paymentStatus: 'PAID' } },
        _sum: { vendorEarnings: true }
      }),
      prisma.vendorOrder.count({
        where: { vendorId: vendor.id, order: { paymentStatus: 'PAID' } }
      }),
      prisma.pageVisit.groupBy({
        by: ['visitorId'],
        where: { vendorId: vendor.id }
      })
    ]);

    const visitorCount = visitors.length;
    const conversionRate = visitorCount > 0 ? (orders / visitorCount) * 100 : 0;

    // Daily sales for last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyStats = await prisma.vendorOrder.findMany({
      where: { vendorId: vendor.id, order: { paymentStatus: 'PAID', createdAt: { gte: sevenDaysAgo } } },
      select: { vendorEarnings: true, createdAt: true }
    });

    return {
      gmv: Number(sales._sum.vendorEarnings || 0),
      orders,
      visitors: visitorCount,
      conversionRate: Number(conversionRate.toFixed(2)),
      dailyStats: dailyStats.map(s => ({ date: s.createdAt, amount: s.vendorEarnings }))
    };
  });

  // 6. Public Profile
  fastify.get('/slug/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const vendor = await prisma.vendorProfile.findUnique({
      where: { storeSlug: slug },
      include: {
        products: {
          where: { status: 'ACTIVE' },
          include: { images: { take: 1 } }
        }
      }
    });

    if (!vendor) return reply.code(404).send({ message: 'Vendor not found' });

    return vendor;
  });

  // Image upload
  fastify.post('/upload', async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ message: 'No file uploaded' });
      }

      const buffer = await data.toBuffer();
      // Use uploadImage for automatic resizing + optimization
      const baseName = `uploads/${Date.now()}-${data.filename.split('.')[0]}`;
      const variantUrls = await fastify.storage.uploadImage(baseName, buffer);
 
      return { 
        url: variantUrls.medium, // Keep medium as primary URL for compatibility
        variants: variantUrls 
      };
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: 'Upload failed' });
    }
  });
}
