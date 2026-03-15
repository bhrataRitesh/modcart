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

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(order.total * 100), // Stripe uses cents
      currency: 'usd',
      metadata: { orderId: order.id },
    });

    return { clientSecret: intent.client_secret };
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
        await prisma.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: 'PAID',
            status: 'PROCESSING',
          },
        });
        fastify.log.info(`Order ${orderId} marked as PAID via webhook`);
      }
    }

    return { received: true };
  });
}
