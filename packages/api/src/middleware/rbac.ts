import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '@modcart/db';
import { UserPayload } from '../types';

export const requireRole = (roles: string[]) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as UserPayload;
    if (!user || !roles.includes(user.role)) {
      return reply.code(403).send({ message: 'Forbidden: Insufficient permissions' });
    }
  };
};

export const requireOwnership = (model: 'product' | 'order' | 'vendorProfile', idParam: string = 'id') => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as UserPayload;
    const params = request.params as Record<string, string>;
    const resourceId = params[idParam];

    if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') return;

    if (model === 'product') {
      const product = await prisma.product.findUnique({
        where: resourceId.startsWith('c') ? { id: resourceId } : { slug: resourceId },
        select: { vendor: { select: { userId: true } } }
      });
      if (!product || product.vendor.userId !== user.id) {
        return reply.code(403).send({ message: 'Forbidden: You do not own this product' });
      }
    }

    if (model === 'vendorProfile') {
      const vendor = await prisma.vendorProfile.findUnique({
        where: resourceId.startsWith('c') ? { id: resourceId } : { storeSlug: resourceId },
        select: { userId: true }
      });
      if (!vendor || vendor.userId !== user.id) {
        return reply.code(403).send({ message: 'Forbidden: You do not own this vendor profile' });
      }
    }

    if (model === 'order') {
       const order = await prisma.order.findUnique({
         where: { id: resourceId },
         select: { userId: true }
       });
       if (!order || order.userId !== user.id) {
         return reply.code(403).send({ message: 'Forbidden: You do not own this order' });
       }
    }
  };
};
