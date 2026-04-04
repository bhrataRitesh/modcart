import { env } from '@modcart/config';
import Stripe from 'stripe';
import { FastifyInstance } from 'fastify';
import { prisma } from '@modcart/db';
import { calculateTotals } from '@modcart/core';
import { validate } from '../middleware/validate';
import { createOrderSchema } from '../schemas/order.schema';
import { UserPayload } from '../types';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16' as any,
});

type CreateOrderBody = z.infer<typeof createOrderSchema>;

export default async function orderRoutes(fastify: FastifyInstance) {
  // Create order (Checkout)
  fastify.post('/checkout', { preHandler: [fastify.authenticate, validate(createOrderSchema)] }, async (request, reply) => {
    const user = request.user as UserPayload;
    const body = request.body as CreateOrderBody;

    const cart = await prisma.cart.findUnique({
      where: { userId: user.id },
      include: { items: { include: { product: true } } },
    });

    if (!cart || cart.items.length === 0) {
      return reply.code(400).send({ message: 'Cart is empty' });
    }

    // Calculate totals
    const totals = calculateTotals(
      cart.items.map(item => ({
        price: Number(item.product.price),
        quantity: item.quantity,
      }))
    );

    // Group items by vendor for VendorOrders
    const itemsByVendor: Record<string, typeof cart.items> = {};
    cart.items.forEach(item => {
      const vId = item.product.vendorId;
      if (!itemsByVendor[vId]) itemsByVendor[vId] = [];
      itemsByVendor[vId].push(item);
    });

    // Start Transaction
    const order = await prisma.$transaction(async (tx) => {
      // 1. Create Main Order
      const mainOrder = await tx.order.create({
        data: {
          userId: user.id,
          subtotal: totals.subtotal,
          total: totals.total,
          taxTotal: totals.taxTotal,
          shippingTotal: totals.shippingTotal,
          discountTotal: totals.discountTotal,
          status: 'PENDING',
          paymentStatus: 'UNPAID',
          shippingAddressId: body.shippingAddressId,
          billingAddressId: body.billingAddressId,
          items: {
            create: cart.items.map(item => ({
              productId: item.productId,
              variantId: item.variantId,
              name: item.product.name,
              sku: (item.product as any).sku || '', // product might have sku or not depending on schema
              price: Number(item.product.price),
              quantity: item.quantity,
              total: Number(item.product.price) * item.quantity,
            })),
          },
        },
      });

      // 2. Create Vendor Orders
      for (const [vendorId, vItems] of Object.entries(itemsByVendor)) {
        const vendor = await tx.vendorProfile.findUnique({ where: { id: vendorId } });
        const vTotals = calculateTotals(vItems.map(i => ({ price: Number(i.product.price), quantity: i.quantity })));
        
        const commissionRate = vendor?.commissionRate || 10;
        const commissionAmount = vTotals.subtotal * (commissionRate / 100);

        await tx.vendorOrder.create({
          data: {
            orderId: mainOrder.id,
            vendorId,
            status: 'PENDING',
            subtotal: vTotals.subtotal,
            commissionRate,
            commissionAmount,
            vendorEarnings: vTotals.subtotal - commissionAmount,
          },
        });
      }

      // 3. Clear Cart
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return mainOrder;
    });

    return order;
  });

  // Get order history
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = request.user as UserPayload;
    return prisma.order.findMany({
      where: { userId: user.id },
      include: { 
        items: {
          include: { product: { select: { name: true } } }
        },
        vendorOrders: {
          include: { vendor: { select: { storeName: true } } }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  // Get single order
  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as UserPayload;
    const { id } = request.params as { id: string };

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        vendorOrders: { include: { vendor: true } },
        shippingAddress: true
      }
    });

    if (!order) return reply.code(404).send({ message: 'Order not found' });
    
    if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN' && order.userId !== user.id) {
       const isVendorOfOrder = order.vendorOrders.some(vo => vo.vendor.userId === user.id);
       if (!isVendorOfOrder) {
         return reply.code(403).send({ message: 'Forbidden' });
       }
    }

    return order;
  });

  // Update order status (ADMIN or VENDOR)
  fastify.patch('/:id/status', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as UserPayload;
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: string };

    const order = await prisma.order.findUnique({
      where: { id },
      include: { vendorOrders: { include: { vendor: true } } }
    });

    if (!order) return reply.code(404).send({ message: 'Order not found' });

    if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
      const isVendorOfOrder = order.vendorOrders.some(vo => vo.vendor.userId === user.id);
      if (!isVendorOfOrder) return reply.code(403).send({ message: 'Forbidden' });
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status: status as any }
    });

    // Stripe Connect Payouts on SHIPPED
    if (status === 'SHIPPED') {
      for (const vo of order.vendorOrders) {
        if (vo.vendor.stripeAccountId && Number(vo.vendorEarnings) > 0 && !vo.payoutId) {
          try {
            fastify.log.info({ vendorOrderId: vo.id }, '💸 Initiating Stripe Connect transfer');
            const transfer = await stripe.transfers.create({
              amount: Math.round(Number(vo.vendorEarnings) * 100),
              currency: 'usd',
              destination: vo.vendor.stripeAccountId,
              metadata: { orderId: order.id, vendorOrderId: vo.id }
            });

            await prisma.vendorOrder.update({
              where: { id: vo.id },
              data: { payoutId: transfer.id, status: 'PAID' as any }
            });
            fastify.log.info({ transferId: transfer.id }, '✅ Transfer successful');
          } catch (e) {
            fastify.log.error(e, '❌ Stripe transfer failed');
          }
        }
      }
    }

    return updatedOrder;
  });
}
