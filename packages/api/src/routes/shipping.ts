import { FastifyInstance } from 'fastify';
import { prisma } from '@modcart/db';
import { calculateShipping } from '../services/shipping.service';
import { calculateTax } from '../services/tax.service';

export default async function shippingRoutes(fastify: FastifyInstance) {
  fastify.post('/rates', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { items, addressId } = request.body as any;
    
    let addressToUse = null;

    if (addressId) {
      addressToUse = await prisma.address.findUnique({ where: { id: addressId } });
    }

    if (!addressToUse) {
      return reply.code(400).send({ message: 'Valid address required to calculate rates' });
    }

    const rates = await calculateShipping(items, addressToUse);
    return { rates };
  });

  fastify.post('/tax', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { subtotal, shippingTotal, addressId } = request.body as any;

    const addressToUse = await prisma.address.findUnique({ where: { id: addressId } });

    if (!addressToUse) {
      return reply.code(400).send({ message: 'Valid address required to calculate tax' });
    }

    const taxDetails = await calculateTax(subtotal, shippingTotal, addressToUse);
    return taxDetails;
  });
}
