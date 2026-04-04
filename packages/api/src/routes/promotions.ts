import { FastifyInstance } from 'fastify';
import { prisma } from '@modcart/db';
import { validateCoupon, getActiveFlashSales } from '../services/promotion.service';
import { z } from 'zod';

export default async function promotionRoutes(fastify: FastifyInstance) {
  // Flash Sales
  fastify.get('/flash-sales', async () => {
    return getActiveFlashSales();
  });

  // Validate Coupon (during checkout)
  fastify.post('/validate-coupon', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { code, subtotal } = request.body as { code: string; subtotal: number };
    const userId = (request.user as any).id;

    try {
      const { coupon, discountAmount } = await validateCoupon(code, userId, subtotal);
      return { 
        valid: true, 
        couponId: coupon.id,
        code: coupon.code,
        discountAmount,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue
      };
    } catch (err: any) {
      return reply.code(400).send({ valid: false, message: err.message });
    }
  });

  // Create Coupon (Admin/Vendor specific)
  fastify.post('/coupons', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any;
    if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN' && user.role !== 'VENDOR') {
      return reply.code(403).send({ message: 'Forbidden' });
    }

    const body = request.body as any;
    const coupon = await prisma.coupon.create({
      data: {
        ...body,
        vendorId: user.role === 'VENDOR' ? user.vendorId : body.vendorId,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
      }
    });

    return coupon;
  });

  // Create Flash Sale (Admin only for now)
  fastify.post('/flash-sales', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any;
    if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
      return reply.code(403).send({ message: 'Forbidden' });
    }

    const body = request.body as any;
    const sale = await prisma.flashSale.create({
      data: {
        ...body,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
      }
    });

    return sale;
  });
}
