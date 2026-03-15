import { FastifyInstance } from 'fastify';
import { prisma } from '@modcart/db';
import { checkoutSchema, calculateTotals } from '@modcart/core';

export default async function orderRoutes(fastify: FastifyInstance) {
  // Create order (Checkout)
  fastify.post('/checkout', { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    const user = request.user as { id: string };
    const body = checkoutSchema.parse(request.body);

    const cart = await prisma.cart.findUnique({
      where: { userId: user.id },
      include: { items: { include: { product: true } } },
    });

    if (!cart || cart.items.length === 0) {
      return reply.code(400).send({ message: 'Cart is empty' });
    }

    // Calculate totals
    const totals = calculateTotals(
      cart.items.map((item: any) => ({
        price: item.product.price,
        quantity: item.quantity,
      }))
    );

    // Group items by vendor for VendorOrders
    const itemsByVendor: Record<string, typeof cart.items> = {};
    cart.items.forEach((item: any) => {
      const vId = item.product.vendorId;
      if (!itemsByVendor[vId]) itemsByVendor[vId] = [];
      itemsByVendor[vId].push(item);
    });

    // Start Transaction
    const order = await prisma.$transaction(async (tx: any) => {
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
            create: cart.items.map((item: any) => ({
              productId: item.productId,
              variantId: item.variantId,
              name: item.product.name,
              sku: item.product.sku || '',
              price: item.product.price,
              quantity: item.quantity,
              total: item.product.price * item.quantity,
            })),
          },
        },
      });

      // 2. Create Vendor Orders
      for (const [vendorId, vItems] of Object.entries(itemsByVendor)) {
        const vendor = await tx.vendorProfile.findUnique({ where: { id: vendorId } });
        const vTotals = calculateTotals(vItems.map((i: any) => ({ price: i.product.price, quantity: i.quantity })));
        
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
  fastify.get('/', { preHandler: [(fastify as any).authenticate] }, async (request) => {
    const user = request.user as { id: string };
    return prisma.order.findMany({
      where: { userId: user.id },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  });
}
