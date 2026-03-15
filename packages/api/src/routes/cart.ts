import { FastifyInstance } from 'fastify';
import { prisma } from '@modcart/db';
import { cartItemSchema } from '@modcart/core';

export default async function cartRoutes(fastify: FastifyInstance) {
  // Get current cart
  fastify.get('/', async (request, reply) => {
    // For now, only authenticated users have a cart for simplicity
    const user = request.user as { id: string } | undefined;
    if (!user) {
      return reply.code(401).send({ message: 'Login required for cart' });
    }

    const cart = await prisma.cart.findUnique({
      where: { userId: user.id },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });

    if (!cart) {
      return { items: [] };
    }

    return cart;
  });

  // Add item to cart
  fastify.post('/items', { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    const user = request.user as { id: string };
    const body = cartItemSchema.parse(request.body);

    let cart = await prisma.cart.findUnique({
      where: { userId: user.id },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId: user.id },
      });
    }

    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId: body.productId,
        variantId: body.variantId || null,
      },
    });

    if (existingItem) {
      return prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + body.quantity },
      });
    }

    return prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: body.productId,
        variantId: body.variantId,
        quantity: body.quantity,
      },
    });
  });

  // Remove item from cart
  fastify.delete('/items/:id', { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.cartItem.delete({
      where: { id },
    });
    return { success: true };
  });
}
