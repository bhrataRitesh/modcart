import { FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import { prisma } from '@modcart/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', {
  apiVersion: '2023-10-16' as any,
});

export default async function paymentRoutes(fastify: FastifyInstance) {
  // Create Payment Intent for an Order
  fastify.post('/create-intent', { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    const { orderId } = request.body as { orderId: string };
    
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return reply.code(404).send({ message: 'Order not found' });
    }

    if (order.paymentStatus === 'PAID') {
      return reply.code(400).send({ message: 'Order already paid' });
    }

    const key = process.env.STRIPE_SECRET_KEY || '';
    let clientSecret = 'mock_client_secret_xyz';
    if (key.startsWith('sk_') && key.length > 20 && !key.includes('...')) {
      const intent = await stripe.paymentIntents.create({
        amount: Math.round(order.total * 100), // Stripe uses cents
        currency: 'usd',
        metadata: { orderId: order.id },
      });
      clientSecret = intent.client_secret as string;
    }

    return { clientSecret };
  });

  // Convert Cart to Order and Create Intent
  fastify.post('/checkout', { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    const user = request.user as { id: string };
    
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
    const vendorOrdersMap = new Map<string, any>();

    for (const item of cart.items) {
      const price = item.variant ? item.variant.price : (item.product.price || 0);
      const itemTotal = price * item.quantity;
      total += itemTotal;

      const vendorId = item.product.vendorId;
      if (!vendorOrdersMap.has(vendorId)) {
        vendorOrdersMap.set(vendorId, {
          subtotal: 0,
          items: []
        });
      }
      
      const vOrder = vendorOrdersMap.get(vendorId);
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
    const key = process.env.STRIPE_SECRET_KEY || '';
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
    const sig = request.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        (request as any).rawBody,
        sig as string,
        process.env.STRIPE_WEBHOOK_SECRET || 'whsec_mock'
      );
    } catch (err: any) {
      return reply.code(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as Stripe.PaymentIntent;
      const orderId = intent.metadata.orderId;

      if (orderId) {
        await prisma.$transaction(async (tx) => {
          // Update Order
          await tx.order.update({
            where: { id: orderId },
            data: {
              paymentStatus: 'PAID',
              status: 'PROCESSING',
            },
          });

          // Update Vendor Orders
          await tx.vendorOrder.updateMany({
            where: { orderId },
            data: {
              status: 'PROCESSING'
            }
          });

          // Fetch items to adjust stock
          const items = await tx.orderItem.findMany({ where: { orderId } });
          for (const item of items) {
            if (item.variantId) {
              await tx.productVariant.update({
                where: { id: item.variantId },
                data: { stockQty: { decrement: item.quantity } }
              });
            } else {
              // Note: main product stock adjustment depends on schema 
              // We'll leave it as variant update for this design
            }
          }
        });
        
        fastify.log.info(`Order ${orderId} marked as PAID via webhook`);
      }
    }

    return { received: true };
  });
}
