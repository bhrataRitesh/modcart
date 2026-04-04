import { FastifyInstance, FastifyRequest } from 'fastify';
import Stripe from 'stripe';
import { prisma } from '@modcart/db';
import { validate } from '../middleware/validate';
import { createPaymentIntentSchema, checkoutPaymentSchema } from '../schemas/payment.schema';
import { env } from '@modcart/config';
import { UserPayload } from '../types';
import { z } from 'zod';

const stripe = new Stripe(env.STRIPE_SECRET_KEY || 'sk_test_mock', {
  apiVersion: '2023-10-16' as Stripe.LatestApiVersion,
});

type CreateIntentBody = z.infer<typeof createPaymentIntentSchema>;

interface WebhookRequest extends FastifyRequest {
  rawBody: Buffer;
}

export default async function paymentRoutes(fastify: FastifyInstance) {
  // Create Payment Intent for an Order
  fastify.post('/create-intent', { preHandler: [fastify.authenticate, validate(createPaymentIntentSchema)] }, async (request, reply) => {
    const { orderId } = request.body as CreateIntentBody;
    
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return reply.code(404).send({ message: 'Order not found' });
    }

    if (order.paymentStatus === 'PAID') {
      return reply.code(400).send({ message: 'Order already paid' });
    }

    const key = env.STRIPE_SECRET_KEY || '';
    let clientSecret = 'mock_client_secret_xyz';
    if (key.startsWith('sk_') && key.length > 20 && !key.includes('...')) {
      const intent = await stripe.paymentIntents.create({
        amount: Math.round(Number(order.total) * 100), // Stripe uses cents
        currency: 'usd',
        metadata: { orderId: order.id },
      });
      clientSecret = intent.client_secret as string;
    }

    return { clientSecret };
  });

  // Convert Cart to Order and Create Intent
  fastify.post('/checkout', { preHandler: [fastify.authenticate, validate(checkoutPaymentSchema)] }, async (request, reply) => {
    const user = request.user as UserPayload;
    
    // 1. Fetch Cart
    const cart = await prisma.cart.findUnique({
      where: { userId: user.id },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          }
        }
      }
    });

    if (!cart || cart.items.length === 0) {
      return reply.code(400).send({ message: 'Cart is empty' });
    }

    // 2. Calculate totals and vendor groupings
    let total = 0;
    const vendorOrdersMap = new Map<string, { subtotal: number, items: any[] }>();

    for (const item of cart.items) {
      const price = item.variant ? Number(item.variant.price) : Number(item.product.price || 0);
      const itemTotal = price * item.quantity;
      total += itemTotal;

      const vendorId = item.product.vendorId;
      if (!vendorOrdersMap.has(vendorId)) {
        vendorOrdersMap.set(vendorId, {
          subtotal: 0,
          items: []
        });
      }
      
      const vOrder = vendorOrdersMap.get(vendorId)!;
      vOrder.subtotal += itemTotal;
      vOrder.items.push({
        productId: item.productId,
        variantId: item.variantId,
        name: item.product.name,
        sku: item.variant?.sku || `SKU-${item.productId}`,
        price: price,
        quantity: item.quantity,
        total: itemTotal
      });
    }

    // 3. Create the Database Order
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        subtotal: total,
        total: total,
        status: 'PENDING',
        paymentStatus: 'UNPAID'
      }
    });

    // 4. Create VendorOrders & Items
    for (const [vId, data] of Array.from(vendorOrdersMap.entries())) {
      const commissionRate = 0.10;
      const commissionAmount = data.subtotal * commissionRate;
      const vendorEarnings = data.subtotal - commissionAmount;

      const vo = await prisma.vendorOrder.create({
        data: {
          orderId: order.id,
          vendorId: vId,
          subtotal: data.subtotal,
          commissionRate,
          commissionAmount,
          vendorEarnings
        }
      });

      for (const i of data.items) {
        await prisma.orderItem.create({
          data: {
            orderId: order.id,
            vendorOrderId: vo.id,
            productId: i.productId,
            variantId: i.variantId,
            name: i.name,
            sku: i.sku,
            price: i.price,
            quantity: i.quantity,
            total: i.total
          }
        });
      }
    }

    // 5. Create Stripe Payment Intent or Mock
    const key = env.STRIPE_SECRET_KEY || '';
    let clientSecret = 'mock_client_secret_xyz';
    if (key.startsWith('sk_') && key.length > 20 && !key.includes('...')) {
      const intent = await stripe.paymentIntents.create({
        amount: Math.round(order.total * 100),
        currency: 'usd',
        metadata: { orderId: order.id },
      });
      clientSecret = intent.client_secret as string;
    }

    // 6. Clear cart
    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id }
    });

    return { clientSecret, orderId: order.id };
  });

  // Stripe Webhook handler
  fastify.post('/webhook', { config: { rawBody: true } }, async (request, reply) => {
    const webhookReq = request as unknown as WebhookRequest;
    const sig = request.headers['stripe-signature'];
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        webhookReq.rawBody,
        sig as string,
        env.STRIPE_WEBHOOK_SECRET || 'whsec_mock'
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return reply.code(400).send(`Webhook Error: ${message}`);
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;
        const orderId = intent.metadata.orderId;

        if (orderId) {
          const finalOrder = await prisma.$transaction(async (tx) => {
            const updated = await tx.order.update({
              where: { id: orderId },
              data: { paymentStatus: 'PAID', status: 'PROCESSING' },
              include: { user: true }
            });
            await tx.vendorOrder.updateMany({
              where: { orderId },
              data: { status: 'PROCESSING' }
            });
            const items = await tx.orderItem.findMany({ where: { orderId } });
            const { adjustStock } = await import('../services/inventory.service');
            for (const item of items) {
              await adjustStock({
                productId: item.productId,
                variantId: item.variantId || undefined,
                change: -item.quantity,
                reason: 'ORDER_SALE',
                referenceId: orderId
              });
            }
            return updated;
          });

          if (finalOrder && finalOrder.user?.email) {
            const { sendOrderConfirmation } = await import('../services/email.service');
            await sendOrderConfirmation(finalOrder.user.email, {
              orderNumber: finalOrder.orderNumber,
              total: Number(finalOrder.total)
            });

            // Notify Vendors
            const vendorOrders = await prisma.vendorOrder.findMany({
              where: { orderId: finalOrder.id },
              include: { vendor: { select: { userId: true } } }
            });

            const { sendNotification } = await import('../services/notification.service');
            await Promise.all(vendorOrders.map(vo => 
              sendNotification({
                userId: vo.vendor.userId,
                type: 'NEW_ORDER',
                title: 'You have a new order!',
                message: `Order #${finalOrder.orderNumber} has been paid. Earnings: $${Number(vo.vendorEarnings).toFixed(2)}`,
                link: '/orders'
              })
            )).catch(err => console.error('Notification failed', err));
          }
          fastify.log.info(`Order ${orderId} marked as PAID via webhook`);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent;
        const orderId = intent.metadata.orderId;
        if (orderId) {
          await prisma.order.update({
            where: { id: orderId },
            data: { paymentStatus: 'FAILED' as any }
          });
          fastify.log.warn(`Order ${orderId} payment FAILED via webhook`);
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const orderId = charge.metadata.orderId;
        if (orderId) {
          await prisma.order.update({
            where: { id: orderId },
            data: { paymentStatus: 'REFUNDED', status: 'CANCELLED' }
          });
          fastify.log.info(`Order ${orderId} marked as REFUNDED via webhook`);
        }
        break;
      }

      default:
        fastify.log.info(`Unhandled event type ${event.type}`);
    }

    return { received: true };
  });
}
