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

const stripe = new Stripe(env.STRIPE_SECRET_KEY as string, {
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

    // Calculate item totals
    const itemTotals = calculateTotals(
      cart.items.map(item => ({
        price: Number(item.product.price),
        quantity: item.quantity,
      }))
    );

    // Dynamic Shipping & Tax
    let shippingTotal = 0;
    let taxTotal = 0;
    let taxBreakdown = [];
    
    if (body.shippingAddressId && body.shippingMethodId) {
      const address = await prisma.address.findUnique({ where: { id: body.shippingAddressId } });
      if (address) {
        // Calculate Shipping
        const { calculateShipping } = await import('../services/shipping.service');
        const availableMethods = await calculateShipping(cart.items, address);
        const selectedMethod = availableMethods.find(m => m.id === body.shippingMethodId);
        
        if (!selectedMethod) {
          return reply.code(400).send({ message: 'Invalid shipping method selected for the given address' });
        }
        shippingTotal = selectedMethod.rate;

        // Calculate Tax
        const { calculateTax } = await import('../services/tax.service');
        const taxDetails = await calculateTax(itemTotals.subtotal, shippingTotal, address);
        taxTotal = taxDetails.taxTotal;
        taxBreakdown = taxDetails.breakdown;
      }
    }

    const finalTotal = itemTotals.subtotal - itemTotals.discountTotal + shippingTotal + taxTotal;

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
          subtotal: itemTotals.subtotal,
          total: finalTotal,
          taxTotal: taxTotal,
          shippingTotal: shippingTotal,
          discountTotal: itemTotals.discountTotal,
          status: 'PENDING',
          paymentStatus: 'UNPAID',
          shippingAddressId: body.shippingAddressId,
          billingAddressId: body.billingAddressId,
          shippingMethodId: body.shippingMethodId,
          taxBreakdown: taxBreakdown,
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

  // ==========================================
  // PHASE 9: RETURNS, REFUNDS & ORDER MANAGEMENT
  // ==========================================

  // Customer initiates return
  fastify.post('/:id/return', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as UserPayload;
    const { id } = request.params as { id: string };
    const { items, reason, resolution } = request.body as any; // items: { orderItemId: string, quantity: number, reason?: string }[]
    
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!order || order.userId !== user.id) {
      return reply.code(403).send({ message: 'Forbidden' });
    }

    const returnReq = await prisma.returnRequest.create({
      data: {
        orderId: order.id,
        userId: user.id,
        reason,
        resolution,
        items: {
          create: items.map((item: any) => ({
            orderItemId: item.orderItemId,
            quantity: item.quantity,
            reason: item.reason
          }))
        }
      }
    });

    return returnReq;
  });

  // Invoice PDF Generation
  fastify.get('/:id/invoice.pdf', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as UserPayload;
    const { id } = request.params as { id: string };

    const order = await prisma.order.findUnique({
      where: { id },
      include: { vendorOrders: { include: { vendor: true } } }
    });

    if (!order) return reply.code(404).send({ message: 'Order not found' });
    
    if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN' && order.userId !== user.id) {
       const isVendorOfOrder = order.vendorOrders.some(vo => vo.vendor.userId === user.id);
       if (!isVendorOfOrder) {
         return reply.code(403).send({ message: 'Forbidden' });
       }
    }

    const { generateInvoicePDF } = await import('../services/invoice.service');
    
    try {
      const pdfBuffer = await generateInvoicePDF(order.id);
      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename=invoice-${order.orderNumber}.pdf`);
      return pdfBuffer;
    } catch (e) {
      return reply.code(500).send({ message: 'Failed to generate PDF' });
    }
  });

  // Order Notes - Get Notes
  fastify.get('/:id/notes', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as UserPayload;
    const { id } = request.params as { id: string };

    const order = await prisma.order.findUnique({
      where: { id },
      include: { vendorOrders: { include: { vendor: true } } }
    });

    if (!order) return reply.code(404).send({ message: 'Order not found' });

    let isInternalAllowed = false;
    if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') {
      isInternalAllowed = true;
    } else {
      const isVendorOfOrder = order.vendorOrders.some(vo => vo.vendor.userId === user.id);
      if (isVendorOfOrder) isInternalAllowed = true;
      else if (order.userId !== user.id) return reply.code(403).send({ message: 'Forbidden' });
    }

    const notes = await prisma.orderNote.findMany({
      where: {
        orderId: id,
        ...(isInternalAllowed ? {} : { isInternal: false })
      },
      include: { user: { select: { firstName: true, lastName: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' }
    });

    return notes;
  });

  // Order Notes - Add Note
  fastify.post('/:id/notes', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as UserPayload;
    const { id } = request.params as { id: string };
    const { content, isInternal } = request.body as { content: string, isInternal?: boolean };

    const order = await prisma.order.findUnique({
      where: { id },
      include: { vendorOrders: { include: { vendor: true } } }
    });

    if (!order) return reply.code(404).send({ message: 'Order not found' });

    let allowInternal = false;
    if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') {
      allowInternal = true;
    } else {
      const isVendorOfOrder = order.vendorOrders.some(vo => vo.vendor.userId === user.id);
      if (isVendorOfOrder) allowInternal = true;
      else if (order.userId !== user.id) return reply.code(403).send({ message: 'Forbidden' });
    }

    const savedNote = await prisma.orderNote.create({
      data: {
        orderId: id,
        userId: user.id,
        content,
        isInternal: allowInternal ? (isInternal || false) : false
      },
      include: { user: { select: { firstName: true, lastName: true, role: true } } }
    });

    return savedNote;
  });

}
